import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  branchCreateRequestSchema,
  branchProjectParamsSchema
} from "@vooster/contracts";
import { createBranch as createBranchWorkflow } from "../application/branches.js";
import { sendCreateBranchResult } from "./branch-results.js";
import { isReadOnlyMembership } from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerBranchRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/projects/:projectId/branches", (request, reply) =>
    createBranch(
      request,
      reply,
      state,
      branchStore,
      projectStore,
      membershipStore,
      mergeRequestStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function createBranch(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = branchCreateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch request"));
  }
  return sendCreateBranchResult(
    reply,
    await createBranchWorkflow(
      {
        branchStore,
        isReadOnlyMembership: (membership) => isReadOnlyMembership(state, membership),
        membershipStore,
        mergeRequestStore,
        projectStore,
        revisionStore,
        useCaseStore
      },
      {
        from: parsed.data.from,
        name: parsed.data.name,
        projectId: projectIdFrom(request.params),
        simulateSnapshotFailure: parsed.data.simulate_snapshot_failure,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function projectIdFrom(params: unknown): string {
  return branchProjectParamsSchema.parse(params).projectId;
}
