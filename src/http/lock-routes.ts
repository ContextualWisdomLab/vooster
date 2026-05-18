import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  blockingLock,
  competingLockProblem,
  expiredLockProblem,
  foreignLockProblem,
  ownsLock
} from "./lock-support.js";
import { membershipForProject } from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredLock, StoredUseCase } from "./signup-types.js";

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

export function registerLockRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/locks", (request, reply) => createLock(request, reply, state));
  app.post("/v1/locks/:lockId/renew", (request, reply) => renewLock(request, reply, state));
}

function createLock(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const parsed = lockSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid lock request"));
  }
  const usecase = useCaseById(state, parsed.data.target_id);
  if (usecase === undefined || usecase.archived_at !== null) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || membershipForProject(request, state, usecase.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const sessionId = sessionIdFrom(request);
  const blockedBy = blockingLock(state.stepLocksByUseCaseId.get(usecase.id), parsed.data.lock_type, sessionId);
  if (blockedBy !== undefined) {
    return reply.code(409).send(competingLockProblem(blockedBy, usecase));
  }
  const lock = useCaseLock(parsed.data, usecase, userId, sessionId);
  state.stepLocksByUseCaseId.set(usecase.id, lock);
  return reply.code(201).send({
    lock,
    suggested_next_actions: [
      {
        command: `vspec lock renew ${usecase.key}`,
        reason: "Renew the lock before it expires."
      },
      {
        command: `vspec unlock ${usecase.key}`,
        reason: "Release the lock when the edit is complete."
      }
    ]
  });
}

function renewLock(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const params = z.object({ lockId: z.string().min(1) }).parse(request.params);
  const parsed = renewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid lock renewal request"));
  }
  const lock = lockById(state, params.lockId);
  if (lock === undefined) {
    return reply.code(404).send(problem(404, "Lock not found"));
  }
  const usecase = useCaseById(state, lock.usecase_id);
  if (usecase === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || membershipForProject(request, state, usecase.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (!ownsLock(lock, userId, sessionIdFrom(request))) {
    return reply.code(403).send(foreignLockProblem(lock, usecase));
  }
  if (Date.parse(lock.expires_at) <= Date.now()) {
    return reply.code(409).send(expiredLockProblem(lock, usecase));
  }

  lock.expires_at = new Date(Date.now() + parsed.data.ttl_minutes * 60_000).toISOString();
  return reply.send({ lock });
}

function lockById(state: SignupState, lockId: string): StoredLock | undefined {
  return [...state.stepLocksByUseCaseId.values()].find((lock) => lock.id === lockId);
}

function useCaseLock(
  data: z.infer<typeof lockSchema>,
  usecase: StoredUseCase,
  userId: string,
  sessionId: null | string
): StoredLock {
  const acquiredAt = new Date();
  return {
    acquired_at: acquiredAt.toISOString(),
    auto_release: true,
    expires_at: new Date(acquiredAt.getTime() + data.ttl_minutes * 60_000).toISOString(),
    held_by_session_id: sessionId,
    held_by_user_id: userId,
    holder: sessionId ?? userId,
    id: randomUUID(),
    lock_type: data.lock_type,
    mode: data.lock_type,
    reason: data.reason,
    target_id: usecase.id,
    target_type: data.target_type,
    usecase_id: usecase.id
  };
}

function useCaseById(state: SignupState, usecaseId: string): StoredUseCase | undefined {
  return [...state.usecasesByProjectId.values()]
    .flat()
    .find((usecase) => usecase.id === usecaseId);
}

function sessionIdFrom(request: FastifyRequest): null | string {
  const header = request.headers["x-vspec-session"];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  return header ?? null;
}
