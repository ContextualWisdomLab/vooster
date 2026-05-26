import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  revisionRevertRequestSchema,
  revisionUsecaseParamsSchema
} from "@vooster/contracts";
import { revertUseCaseRevision } from "../application/revision-revert.js";
import { sendRevisionRevertResult } from "./revision-revert-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export function registerRevisionRevertRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/usecases/:usecaseId/revert", (request, reply) =>
    revertUseCase(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      projectStore,
      revisionStore,
      workSessionStore,
      useCaseStore
    )
  );
}

async function revertUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const params = revisionUsecaseParamsSchema.parse(request.params);
  const parsed = revisionRevertRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid revert request"));
  }
  return sendRevisionRevertResult(
    reply,
    await revertUseCaseRevision(
      {
        branchStore,
        lockStore,
        membershipStore,
        projectStore,
        revisionStore,
        useCaseStore,
        workSessionStore
      },
      {
        force: parsed.data.force,
        revisionId: parsed.data.revision_id,
        simulateGherkinDrift: parsed.data.simulate_gherkin_drift,
        simulateWriteFailure: parsed.data.simulate_write_failure,
        usecaseId: params.usecaseId,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}
