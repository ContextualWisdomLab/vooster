import type { FastifyReply } from "fastify";
import { lockResponseSchema } from "@vooster/contracts";
import type { LockResult } from "../application/locks.js";
import {
  competingLockProblem,
  expiredLockProblem,
  foreignLockProblem
} from "./lock-support.js";
import { problem } from "./signup-support.js";

export function sendLockResult(reply: FastifyReply, result: LockResult) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send(createdLockResponse(result));
    case "RENEWED":
      return reply.send(lockResponseSchema.parse({ lock: result.lock }));
    case "RELEASED":
      return reply.send(lockResponseSchema.parse({ lock: result.lock }));
    case "COMPETING_LOCK":
      return reply.code(409).send(competingLockProblem(result.lock, result.usecase));
    case "EXPIRED_LOCK":
      return reply.code(409).send(expiredLockProblem(result.lock, result.usecase));
    case "FOREIGN_LOCK":
      return reply.code(403).send(foreignLockProblem(result.lock, result.usecase));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "LOCK_NOT_FOUND":
      return reply.code(404).send(problem(404, "Lock not found"));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
  }
}

function createdLockResponse(result: {
  lock: unknown;
  usecase: { id: string };
  warnings?: unknown;
}) {
  const lockId = lockIdFrom(result.lock);
  const commandTarget = typeof lockId === "string" ? lockId : result.usecase.id;
  return lockResponseSchema.parse({
    lock: result.lock,
    suggested_next_actions: [
      {
        command: `vspec lock renew ${commandTarget}`,
        reason: "Renew the lock before it expires."
      },
      {
        command: `vspec lock release ${commandTarget}`,
        reason: "Release the lock when the edit is complete."
      }
    ],
    ...(result.warnings === undefined ? {} : { warnings: result.warnings })
  });
}

function lockIdFrom(lock: unknown): string | undefined {
  if (typeof lock !== "object" || lock === null || !("id" in lock)) {
    return undefined;
  }
  const id = (lock as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}
