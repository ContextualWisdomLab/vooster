import type { FastifyReply } from "fastify";
import type {
  UseCaseArchiveResult,
  UseCaseRestoreResult
} from "../application/usecase-archive.js";
import { problem } from "./signup-support.js";

export function sendArchiveUseCaseResult(
  reply: FastifyReply,
  result: UseCaseArchiveResult
) {
  switch (result.status) {
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "HARD_DELETE_REQUESTED":
      return reply.code(400).send(hardDeleteProblem(result.usecase.key));
    case "ALREADY_ARCHIVED":
      return reply.code(409).send(alreadyArchivedProblem(result.usecase));
    case "HARD_LOCKED":
      return reply.code(409).send(
        problem(409, "Use case has an active HARD lock", {
          expires_at: result.expiresAt,
          holding_session: result.holdingSession
        })
      );
    case "ARCHIVED":
      return reply.send({
        active_locks_count: result.activeLocksCount,
        affected_sessions: result.affectedSessions,
        affected_sessions_count: result.affectedSessions.length,
        revision: result.revision,
        suggested_next_actions: [
          {
            command: `vspec usecase restore ${result.usecase.key}`,
            reason: "Restore the use case if it returns to scope."
          }
        ],
        usecase: result.usecase
      });
  }
}

export function sendRestoreUseCaseResult(
  reply: FastifyReply,
  result: UseCaseRestoreResult
) {
  switch (result.status) {
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "NOT_ARCHIVED":
      return reply.code(409).send(problem(409, "Use case is not archived"));
    case "RESTORED":
      return reply.send({
        revision: result.revision,
        usecase: result.usecase
      });
  }
}

function hardDeleteProblem(usecaseKey: string) {
  return problem(
    400,
    "Destructive deletion is post-MVP",
    { destructive_delete: true },
    [
      {
        command: `vspec usecase archive ${usecaseKey}`,
        reason: "Archive is the supported reversible removal path."
      }
    ]
  );
}

function alreadyArchivedProblem(usecase: { archived_at: null | string; key: string }) {
  return problem(
    409,
    "Use case is already archived",
    { archived_at: usecase.archived_at },
    [
      {
        command: `vspec usecase restore ${usecase.key}`,
        reason: "Restore the archived use case instead."
      }
    ]
  );
}
