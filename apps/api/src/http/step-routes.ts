import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  stepMoveRequestSchema,
  stepParamsSchema,
  stepPatchRequestSchema
} from "@vooster/contracts";
import { moveScenarioStep } from "../application/scenario-authoring.js";
import { editStep } from "../application/step-editing.js";
import { createTestLock } from "./step-lock-support.js";
import { createTestWorkSession } from "./step-session-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { sendStepEditingResult, sendStepMoveResult } from "./step-results.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

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
  app.post("/v1/steps/:stepId/move", (request, reply) =>
    moveStep(
      request,
      reply,
      state,
      membershipStore,
      scenarioStore,
      revisionStore,
      stepStore,
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

async function moveStep(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  revisionStore: RevisionStore,
  stepStore: StepStore,
  useCaseStore: UseCaseStore
) {
  const parsed = stepMoveRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid step move"));
  }
  return sendStepMoveResult(
    reply,
    await moveScenarioStep(
      {
        membershipStore,
        revisionStore,
        scenarioStore,
        stepStore,
        useCaseStore
      },
      {
        stepId: stepParamsSchema.parse(request.params).stepId,
        toPosition: parsed.data.to,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
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
  const parsed = stepPatchRequestSchema.safeParse(request.body);
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
        implementationRefs: parsed.data.implements,
        notes: parsed.data.notes,
        stepId: stepParamsSchema.parse(request.params).stepId,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}
