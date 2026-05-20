import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { StoredLock } from "../domain/entities/index.js";
import type { LockStore } from "../ports/lock-store.js";

const lockBodySchema = z.object({
  expires_at: z.string().min(1),
  holder: z.string().min(1),
  mode: z.enum(["HARD", "SEMANTIC"]),
  reason: z.string().min(1)
});

export function createTestLock(
  request: FastifyRequest,
  reply: FastifyReply,
  lockStore: LockStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = lockBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid lock request"));
  }

  const lock: StoredLock = { ...parsed.data, usecase_id: params.usecaseId };
  return lockStore.saveLock(lock).then(() => reply.code(201).send({ lock }));
}

export function semanticLockProblem(lock: StoredLock) {
  return problem(
    409,
    "Use case has a semantic lock",
    {
      expires_at: lock.expires_at,
      lock_holder: lock.holder,
      lock_reason: lock.reason
    },
    [
      {
        command: "vspec unlock",
        reason: "Coordinate with the lock holder before changing semantic fields."
      }
    ]
  );
}

export function hardLockProblem(lock: StoredLock) {
  return problem(
    409,
    "Use case has a hard lock",
    {
      expires_at: lock.expires_at,
      lock_holder: lock.holder,
      lock_reason: lock.reason
    },
    [
      {
        command: "vspec unlock",
        reason: "Unlock the use case or contact the lock holder before editing."
      }
    ]
  );
}
