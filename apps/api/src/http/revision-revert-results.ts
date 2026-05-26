import type { FastifyReply } from "fastify";
import { revisionRevertResponseSchema } from "@vooster/contracts";
import type { RevisionRevertResult } from "../application/revision-revert-types.js";
import { problem } from "./signup-support.js";
import type { StoredLock } from "../domain/entities/index.js";
import type { StoredRevision, StoredUseCase } from "../domain/entities/index.js";

export function sendRevisionRevertResult(
  reply: FastifyReply,
  result: RevisionRevertResult
) {
  switch (result.status) {
    case "BREAKING_REVERT":
      return reply.code(409).send(breakingRevertProblem(result));
    case "CURRENT_REVISION_NOT_FOUND":
      return reply.code(404).send(problem(404, "Revision not found"));
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Not authorized to revert use case"));
    case "HARD_LOCKED":
      return reply.code(409).send(hardLockProblem(result.usecase, result.lock));
    case "REVERTED":
      return reply.code(201).send(
        revisionRevertResponseSchema.parse({
          impact: result.impact,
          revision: result.revision,
          suggested_next_actions: result.suggestedNextActions,
          usecase: result.usecase,
          ...(result.warnings === undefined ? {} : { warnings: result.warnings })
        })
      );
    case "TARGET_REVISION_NOT_FOUND":
      return reply
        .code(404)
        .send(missingRevisionProblem(result.usecase, result.revisionId));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "WRITE_FAILED":
      return reply
        .code(500)
        .send(writeFailureProblem(result.usecase, result.targetRevisionId));
  }
}

function missingRevisionProblem(usecase: StoredUseCase, revisionId: string) {
  return problem(
    404,
    "Revision not found",
    { expected_entity_id: usecase.id, missing_revision: revisionId },
    [
      {
        command: `vspec history ${usecase.key}`,
        reason: "Find valid revision IDs for this use case."
      }
    ]
  );
}

function hardLockProblem(usecase: StoredUseCase, lock: StoredLock) {
  return problem(
    409,
    "Use case is HARD locked",
    {
      expires_at: lock.expires_at,
      held_by_user_id: lock.held_by_user_id,
      holding_session: lock.held_by_session_id,
      reason: lock.reason
    },
    [
      {
        command: `vspec who ${usecase.key}`,
        reason: "Find the lock holder before retrying the revert."
      }
    ]
  );
}

function breakingRevertProblem(result: {
  affectedSessions: string[];
  currentRevision: StoredRevision;
  targetRevisionId: string;
  usecase: StoredUseCase;
}) {
  return problem(
    409,
    "Revert would reintroduce breaking changes",
    {
      affected_sessions: result.affectedSessions,
      breaking_changes: [
        {
          path: "usecase.title",
          revision: result.currentRevision.id,
          severity: "BREAKING"
        }
      ]
    },
    [
      {
        command: `vspec revert ${result.usecase.key} --to ${result.targetRevisionId} --force --summary "<reason>"`,
        reason: "Rerun with force only if the breaking impact is acceptable."
      }
    ]
  );
}

function writeFailureProblem(usecase: StoredUseCase, targetRevision: string) {
  return problem(500, "Revert write failed", { exit_code: 5 }, [
    {
      command: `vspec revert ${usecase.key} --to ${targetRevision} --retry`,
      reason: "Retry after the revert write failure."
    }
  ]);
}
