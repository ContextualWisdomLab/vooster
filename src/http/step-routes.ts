import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { appendUseCaseRevision, scenarioWithUseCase } from "./scenario-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredMembership,
  StoredStep,
  StoredUseCase
} from "./signup-types.js";

const stepPatchSchema = z.object({
  action: z.string().optional(),
  base_revision: z.string().min(1),
  force: z.boolean().default(false)
});

export function registerStepRoutes(app: FastifyInstance, state: SignupState) {
  app.patch("/v1/steps/:stepId", (request, reply) => patchStep(request, reply, state));
}

function patchStep(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = stepWithUseCase(state, stepIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Step not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = stepPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid step update"));
  }
  const currentRevision = currentRevisionId(state, found.usecase);
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

  const updated = { ...found.step, action: parsed.data.action ?? found.step.action };
  state.stepsByScenarioId.set(
    found.step.scenario_id,
    found.steps.map((step) => (step.id === updated.id ? updated : step))
  );
  const revision = appendUseCaseRevision(
    state,
    found.usecase,
    `Edited step ${updated.id}`,
    "BREAKING"
  );

  return reply.send({ affected_sessions: [], revision, step: updated });
}

function stepWithUseCase(
  state: SignupState,
  stepId: string
):
  | {
      projectId: string;
      step: StoredStep;
      steps: StoredStep[];
      usecase: StoredUseCase;
    }
  | undefined {
  for (const [scenarioId, steps] of state.stepsByScenarioId) {
    const step = steps.find((candidate) => candidate.id === stepId);
    const found = step === undefined ? undefined : scenarioWithUseCase(state, scenarioId);
    if (step !== undefined && found !== undefined) {
      return { projectId: found.projectId, step, steps, usecase: found.usecase };
    }
  }

  return undefined;
}

function currentRevisionId(state: SignupState, usecase: StoredUseCase): string {
  const revisions = state.revisionsByEntityId.get(usecase.id) ?? [];
  return revisions[revisions.length - 1]?.id ?? usecase.current_revision_id;
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

function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (project === undefined || userId === undefined) {
    return undefined;
  }

  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}

function stepIdFrom(params: unknown): string {
  return z.object({ stepId: z.string().min(1) }).parse(params).stepId;
}
