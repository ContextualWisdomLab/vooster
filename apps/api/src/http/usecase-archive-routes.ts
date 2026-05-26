import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { usecaseArchiveQuerySchema, usecaseParamsSchema } from "@vooster/contracts";
import {
  archiveUseCase as archiveUseCaseWorkflow,
  restoreUseCase as restoreUseCaseWorkflow
} from "../application/usecase-archive.js";
import { authenticatedUserId } from "./session-support.js";
import type { SignupState } from "./signup-types.js";
import {
  sendArchiveUseCaseResult,
  sendRestoreUseCaseResult
} from "./usecase-archive-results.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export function registerUseCaseArchiveRoutes(
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
  app.delete("/v1/usecases/:usecaseId", (request, reply) =>
    archiveUseCase(
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

async function archiveUseCase(
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
  return sendArchiveUseCaseResult(
    reply,
    await archiveUseCaseWorkflow(
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
        hardDeleteRequested: usecaseArchiveQuerySchema.parse(request.query),
        usecaseId: usecaseIdFrom(request.params),
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

export async function restoreArchivedUseCase(
  reply: FastifyReply,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  usecaseId: string,
  userId: string | undefined
) {
  return sendRestoreUseCaseResult(
    reply,
    await restoreUseCaseWorkflow(
      {
        branchStore,
        lockStore: undefined as never,
        membershipStore,
        projectStore,
        revisionStore,
        useCaseStore,
        workSessionStore: undefined as never
      },
      {
        hardDeleteRequested: false,
        usecaseId,
        userId
      }
    )
  );
}

function usecaseIdFrom(params: unknown): string {
  return usecaseParamsSchema.parse(params).usecaseId;
}
