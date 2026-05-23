import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { editStep } from "../application/step-editing.js";
import { createTestLock } from "./step-lock-support.js";
import { createTestWorkSession } from "./step-session-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { sendStepEditingResult } from "./step-results.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const stepPatchSchema = z.object({
  action: z.string().optional(),
  actor: z.string().optional(),
  base_revision: z.string().min(1),
  force: z.boolean().default(false),
  notes: z.string().optional()
});

export function registerStepRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
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
      actorStore,
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
  actorStore: ActorStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  revisionStore: RevisionStore,
  stepStore: StepStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = stepPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid step update"));
  }
  return sendStepEditingResult(
    reply,
    await editStep(
      {
        actorStore,
        lockStore,
        membershipStore,
        revisionStore,
        scenarioStore,
        stepStore,
        useCaseStore,
        workSessionStore
      },
      {
        action: parsed.data.action,
        actorName: parsed.data.actor,
        baseRevision: parsed.data.base_revision,
        force: parsed.data.force,
        notes: parsed.data.notes,
        stepId: stepIdFrom(request.params),
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function stepIdFrom(params: unknown): string {
  return z.object({ stepId: z.string().min(1) }).parse(params).stepId;
}
