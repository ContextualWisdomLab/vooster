import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { updateUseCaseMetadata } from "../application/usecases.js";
import { membershipForProject } from "./membership-support.js";
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
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED"]).optional()
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
        status: parsed.data.status,
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
  const found = await useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (
    (await membershipForProject(request, state, membershipStore, found.projectId)) ===
    undefined
  ) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  return restoreArchivedUseCase(
    reply,
    state,
    branchStore,
    projectStore,
    revisionStore,
    useCaseStore,
    found
  );
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
