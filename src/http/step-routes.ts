import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createTestLock, hardLockProblem, semanticLockProblem } from "./step-lock-support.js";
import {
  affectedSessionIds,
  createTestWorkSession
} from "./step-session-support.js";
import { appendUseCaseRevision, scenarioWithUseCase } from "./scenario-support.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredStep,
  StoredUseCase
} from "./signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const stepPatchSchema = z.object({
  action: z.string().optional(),
  base_revision: z.string().min(1),
  force: z.boolean().default(false),
  notes: z.string().optional()
});

export function registerStepRoutes(
  app: FastifyInstance,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  revisionStore: RevisionStore,
  stepStore: StepStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.patch("/v1/steps/:stepId", (request, reply) =>
    patchStep(
      request,
      reply,
      state,
      lockStore,
      membershipStore,
      scenarioStore,
      revisionStore,
      stepStore,
      workSessionStore,
      useCaseStore
    )
  );
  app.post("/__test/usecases/:usecaseId/locks", (request, reply) =>
    createTestLock(request, reply, lockStore)
  );
  app.post("/__test/usecases/:usecaseId/work-sessions", (request, reply) =>
    createTestWorkSession(request, reply, workSessionStore)
  );
}

async function patchStep(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  revisionStore: RevisionStore,
  stepStore: StepStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const found = await stepWithUseCase(
    scenarioStore,
    stepStore,
    useCaseStore,
    stepIdFrom(request.params)
  );
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Step not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = stepPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid step update"));
  }
  const currentRevision = await currentRevisionId(revisionStore, found.usecase);
  if (parsed.data.base_revision !== currentRevision) {
    return reply
      .code(409)
      .send(staleBaseRevisionProblem(found.usecase, parsed.data.base_revision, currentRevision));
  }
  if (parsed.data.action !== undefined && parsed.data.action.trim().length === 0) {
    return reply.code(400).send(problem(400, "Step action is required"));
  }
  if (
    parsed.data.action !== undefined &&
    !parsed.data.force &&
    usesPassiveVoice(parsed.data.action)
  ) {
    return reply.code(422).send(passiveStepEditProblem(parsed.data.action));
  }
  const lock = await lockStore.findLockForUseCase(found.usecase.id);
  if (lock?.mode === "HARD") {
    return reply.code(409).send(hardLockProblem(lock));
  }
  if (lock?.mode === "SEMANTIC" && parsed.data.action !== undefined) {
    return reply.code(409).send(semanticLockProblem(lock));
  }

  const updated = {
    ...found.step,
    action: parsed.data.action ?? found.step.action,
    notes: parsed.data.notes ?? found.step.notes
  };
  await stepStore.updateStep(updated);
  const revision = await appendUseCaseRevision(
    revisionStore,
    found.usecase,
    `Edited step ${updated.id}`,
    parsed.data.action === undefined && parsed.data.notes !== undefined
      ? "COSMETIC"
      : "BREAKING"
  );

  return reply.send({
    affected_sessions: await affectedSessionIds(workSessionStore, found.usecase.id),
    revision,
    step: updated
  });
}

async function stepWithUseCase(
  scenarioStore: ScenarioStore,
  stepStore: StepStore,
  useCaseStore: UseCaseStore,
  stepId: string
): Promise<
  | {
      projectId: string;
      step: StoredStep;
      steps: StoredStep[];
      usecase: StoredUseCase;
    }
  | undefined
> {
  const step = await stepStore.findStepById(stepId);
  if (step === undefined) {
    return undefined;
  }
  const found = await scenarioWithUseCase(scenarioStore, useCaseStore, step.scenario_id);
  if (found !== undefined) {
    return {
      projectId: found.projectId,
      step,
      steps: await stepStore.listSteps(step.scenario_id),
      usecase: found.usecase
    };
  }

  return undefined;
}

async function currentRevisionId(
  revisionStore: RevisionStore,
  usecase: StoredUseCase
): Promise<string> {
  return (await revisionStore.latestRevision(usecase.id))?.id ?? usecase.current_revision_id;
}

function staleBaseRevisionProblem(
  usecase: StoredUseCase,
  baseRevision: string,
  currentRevision: string
) {
  return problem(
    409,
    "Base revision is stale",
    {
      current_revision_id: currentRevision,
      revision_diff: {
        base_revision: baseRevision,
        current_revision: currentRevision
      }
    },
    [
      {
        command: `vspec usecase show ${usecase.key}`,
        reason: "Inspect the current use case before retrying the step edit."
      }
    ]
  );
}

function passiveStepEditProblem(action: string) {
  return problem(
    422,
    "Step action uses passive voice",
    { suggested_action: activeRewrite(action) },
    [
      {
        command: "vspec step edit --force",
        reason: "Persist this wording after reviewing the passive voice warning."
      }
    ]
  );
}

function usesPassiveVoice(action: string): boolean {
  return /^.+?\s+is\s+\w+ed\.?$/i.test(action.trim());
}

function activeRewrite(action: string): string {
  const match = /^(?<object>.+?)\s+is\s+(?<verb>\w+)\.?$/i.exec(action.trim());
  if (match?.groups?.object === undefined || match.groups.verb === undefined) {
    return "Rewrite the step in active voice.";
  }

  return `${capitalized(match.groups.verb)} the ${match.groups.object.toLowerCase()}.`;
}

function capitalized(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function stepIdFrom(params: unknown): string {
  return z.object({ stepId: z.string().min(1) }).parse(params).stepId;
}
