import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState, StoredLock } from "./signup-types.js";

const lockBodySchema = z.object({
  expires_at: z.string().min(1),
  holder: z.string().min(1),
  mode: z.enum(["HARD", "SEMANTIC"]),
  reason: z.string().min(1)
});

export function createTestLock(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = lockBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid lock request"));
  }

  const lock: StoredLock = { ...parsed.data, usecase_id: params.usecaseId };
  state.stepLocksByUseCaseId.set(params.usecaseId, lock);
  return reply.code(201).send({ lock });
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
