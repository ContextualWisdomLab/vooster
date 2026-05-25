import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  updateUseCaseMetadata,
  type UseCaseMetadataChanges
} from "../application/usecases.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { restoreArchivedUseCase } from "./usecase-archive-routes.js";
import { sendUseCaseUpdateResult } from "./usecase-results.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const useCasePatchSchema = z.object({
  archived_at: z.null().optional(),
  format: z.enum(["BRIEF"]).optional(),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  scope: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED"]).optional(),
  title: z.string().min(1).optional()
});

export function registerUseCaseUpdateRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  stakeholderInterestStore: StakeholderInterestStore,
  useCaseStore: UseCaseStore
) {
  app.patch("/v1/usecases/:usecaseId", (request, reply) =>
    patchUseCase(
      request,
      reply,
      state,
      branchStore,
      membershipStore,
      projectStore,
      revisionStore,
      stakeholderInterestStore,
      useCaseStore
    )
  );
}

async function patchUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  stakeholderInterestStore: StakeholderInterestStore,
  useCaseStore: UseCaseStore
) {
  const parsed = useCasePatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid use case update"));
  }
  const usecaseId = usecaseIdFrom(request.params);
  if (parsed.data.archived_at === null) {
    return restoreUseCase(
      request,
      reply,
      state,
      branchStore,
      membershipStore,
      projectStore,
      revisionStore,
      useCaseStore,
      usecaseId
    );
  }
  return sendUseCaseUpdateResult(
    reply,
    await updateUseCaseMetadata(
      { membershipStore, stakeholderInterestStore, useCaseStore },
      {
        changes: metadataChangesFrom(parsed.data),
        usecaseId,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

async function restoreUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  usecaseId: string
) {
  return restoreArchivedUseCase(
    reply,
    branchStore,
    membershipStore,
    projectStore,
    revisionStore,
    useCaseStore,
    usecaseId,
    authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  );
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}

function metadataChangesFrom(
  data: z.infer<typeof useCasePatchSchema>
): UseCaseMetadataChanges {
  return {
    ...(data.format === undefined ? {} : { format: data.format }),
    ...(data.level === undefined ? {} : { level: data.level }),
    ...(data.priority === undefined ? {} : { priority: data.priority }),
    ...(data.scope === undefined ? {} : { scope: data.scope }),
    ...(data.status === undefined ? {} : { status: data.status }),
    ...(data.title === undefined ? {} : { title: data.title })
  };
}
