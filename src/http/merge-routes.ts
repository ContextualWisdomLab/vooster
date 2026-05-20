import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { openMerge as openMergeWorkflow } from "../application/merges.js";
import { sendOpenMergeResult } from "./merge-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const mergeOpenSchema = z.object({
  simulate_write_failure: z.boolean().default(false),
  source_branch_id: z.string().min(1),
  strategy: z.enum(["FAST_FORWARD", "SQUASH"]).optional(),
  target: z.literal("main").default("main")
});

export function registerMergeRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/merges", (request, reply) =>
    openMerge(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      mergeRequestStore,
      projectStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function openMerge(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = mergeOpenSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid merge request"));
  }
  return sendOpenMergeResult(
    reply,
    await openMergeWorkflow(
      {
        branchStore,
        lockStore,
        membershipStore,
        mergeRequestStore,
        projectStore,
        revisionStore,
        useCaseStore
      },
      {
        simulateWriteFailure: parsed.data.simulate_write_failure,
        sourceBranchId: parsed.data.source_branch_id,
        strategy: parsed.data.strategy,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}
