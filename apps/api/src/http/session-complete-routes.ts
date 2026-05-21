import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { completeSession as completeSessionWorkflow } from "../application/session-completion.js";
import { sendCompleteSessionResult } from "./session-completion-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const completeSchema = z.object({
  no_merge: z.boolean().default(false),
  simulate_conflicts: z.boolean().default(false),
  simulate_completion_failure: z.boolean().default(false),
  simulate_failed_lock_release: z.string().optional(),
  summary: z.string().optional()
});

export function registerSessionCompleteRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  projectStore: ProjectStore,
  workSessionStore: WorkSessionStore
) {
  app.post("/v1/sessions/:sessionId/complete", (request, reply) =>
    completeSession(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      mergeRequestStore,
      projectStore,
      workSessionStore
    )
  );
}

async function completeSession(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  projectStore: ProjectStore,
  workSessionStore: WorkSessionStore
) {
  const parsed = completeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid session completion request"));
  }
  return sendCompleteSessionResult(
    reply,
    await completeSessionWorkflow(
      {
        branchStore,
        lockStore,
        membershipStore,
        mergeRequestStore,
        projectStore,
        workSessionStore
      },
      {
        noMerge: parsed.data.no_merge,
        sessionId: sessionIdFrom(request.params),
        simulateCompletionFailure: parsed.data.simulate_completion_failure,
        simulateConflicts: parsed.data.simulate_conflicts,
        simulateFailedLockRelease: parsed.data.simulate_failed_lock_release,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function sessionIdFrom(params: unknown): string {
  return z.object({ sessionId: z.string().min(1) }).parse(params).sessionId;
}
