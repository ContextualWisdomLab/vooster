import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { resolveMerge as resolveMergeWorkflow } from "../application/merge-resolution.js";
import { sendResolveMergeResult } from "./merge-resolution-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const resolutionSchema = z.object({
  entity_id: z.string().min(1),
  field: z.string().optional(),
  strategy: z.enum(["MANUAL", "MINE", "THEIRS"]),
  value: z.unknown().optional()
});
const resolveSchema = z.object({
  base_revision: z.string().min(1),
  resolutions: z.array(resolutionSchema).min(1),
  simulate_write_failure: z.boolean().default(false)
});

export function registerMergeResolveRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/merges/:mergeId/resolve", (request, reply) =>
    resolveMerge(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      mergeRequestStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function resolveMerge(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = resolveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid merge resolution request"));
  }
  return sendResolveMergeResult(
    reply,
    await resolveMergeWorkflow(
      {
        branchStore,
        lockStore,
        membershipStore,
        mergeRequestStore,
        revisionStore,
        useCaseStore
      },
      {
        baseRevision: parsed.data.base_revision,
        mergeId: mergeIdFrom(request.params),
        resolutions: parsed.data.resolutions,
        simulateWriteFailure: parsed.data.simulate_write_failure,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function mergeIdFrom(params: unknown): string {
  return z.object({ mergeId: z.string().min(1) }).parse(params).mergeId;
}
