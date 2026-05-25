import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  acquireLock,
  releaseLock as releaseLockApplication,
  renewLock as renewLockApplication
} from "../application/locks.js";
import { sendLockResult } from "./lock-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const lockSchema = z.object({
  lock_type: z.enum(["SOFT", "SEMANTIC", "HARD"]),
  reason: z.string().min(1),
  target_id: z.string().min(1),
  target_type: z.literal("USECASE"),
  ttl_minutes: z.number().positive().default(30)
});
const renewSchema = z.object({
  ttl_minutes: z.number().positive().default(30)
});

export function registerLockRoutes(
  app: FastifyInstance,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/locks", (request, reply) =>
    createLock(request, reply, state, lockStore, membershipStore, useCaseStore)
  );
  app.post("/v1/locks/:lockId/renew", (request, reply) =>
    renewLock(request, reply, state, lockStore, membershipStore, useCaseStore)
  );
  app.delete("/v1/locks/:lockId", (request, reply) =>
    releaseLock(request, reply, state, lockStore, membershipStore, useCaseStore)
  );
}

async function createLock(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const parsed = lockSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid lock request"));
  }
  return sendLockResult(
    reply,
    await acquireLock(
      { lockStore, membershipStore, useCaseStore },
      {
        lockType: parsed.data.lock_type,
        reason: parsed.data.reason,
        sessionId: sessionIdFrom(request),
        targetId: parsed.data.target_id,
        targetType: parsed.data.target_type,
        ttlMinutes: parsed.data.ttl_minutes,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

async function renewLock(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ lockId: z.string().min(1) }).parse(request.params);
  const parsed = renewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid lock renewal request"));
  }
  return sendLockResult(
    reply,
    await renewLockApplication(
      { lockStore, membershipStore, useCaseStore },
      {
        lockId: params.lockId,
        sessionId: sessionIdFrom(request),
        ttlMinutes: parsed.data.ttl_minutes,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

async function releaseLock(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ lockId: z.string().min(1) }).parse(request.params);
  return sendLockResult(
    reply,
    await releaseLockApplication(
      { lockStore, membershipStore, useCaseStore },
      {
        lockId: params.lockId,
        sessionId: sessionIdFrom(request),
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function sessionIdFrom(request: FastifyRequest): null | string {
  const header = request.headers["x-vspec-session"];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  return header ?? null;
}
