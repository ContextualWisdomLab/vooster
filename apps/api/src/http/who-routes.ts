import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { whoIsWorking } from "../application/who-is-working.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";
import { authenticatedUserId } from "./session-support.js";
import type { SignupState } from "./signup-types.js";
import { sendWhoResult } from "./who-results.js";

export function registerWhoRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.get("/v1/usecases/:usecaseId/who", (request, reply) =>
    showWho(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      mergeRequestStore,
      workSessionStore,
      useCaseStore
    )
  );
}

async function showWho(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const result = await whoIsWorking(
    {
      branchStore,
      lockStore,
      membershipStore,
      mergeRequestStore,
      useCaseStore,
      workSessionStore
    },
    {
      usecaseId: usecaseIdFrom(request.params),
      userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
    }
  );
  return sendWhoResult(reply, result);
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
