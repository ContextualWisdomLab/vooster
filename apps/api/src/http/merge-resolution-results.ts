import type { FastifyReply } from "fastify";
import { mergeResolveResponseSchema } from "@vooster/contracts";
import type { ResolveMergeResult } from "../application/merge-resolution.js";
import {
  missingManualValueProblem,
  staleBaseProblem,
  uncoveredConflictsProblem
} from "./merge-resolve-validation.js";
import { problem } from "./signup-support.js";

export function sendResolveMergeResult(
  reply: FastifyReply,
  result: ResolveMergeResult
) {
  switch (result.status) {
    case "MERGE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Merge request not found"));
    case "BRANCH_NOT_FOUND":
      return reply.code(404).send(problem(404, "Merge branch not found"));
    case "ACCESS_DENIED":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "NO_OPEN_CONFLICTS":
      return reply.code(409).send(problem(409, "Merge request has no open conflicts"));
    case "STALE_BASE":
      return reply.code(409).send(staleBaseProblem(result.mergeRequest));
    case "MISSING_MANUAL_VALUE":
      return reply
        .code(400)
        .send(missingManualValueProblem(result.mergeRequest, result.resolution));
    case "UNCOVERED_CONFLICTS":
      return reply
        .code(422)
        .send(uncoveredConflictsProblem(result.mergeRequest, result.uncovered));
    case "HARD_LOCK":
      return reply.code(409).send(
        problem(
          409,
          "Target entity has a hard lock",
          {
            holding_session: result.holdingSession,
            main_head_revision_ids: result.mainHeadRevisionIds,
            merge_request: result.mergeRequest
          },
          [
            {
              command: `vspec who ${result.useCaseKey}`,
              reason: "Inspect the session holding the hard lock."
            }
          ]
        )
      );
    case "WRITE_FAILED":
      return reply.code(500).send(
        problem(
          500,
          "Conflict resolution write failed",
          {
            exit_code: result.exitCode,
            main_head_revision_ids: result.mainHeadRevisionIds,
            merge_request: result.mergeRequest,
            source_branch: result.sourceBranch
          },
          [
            {
              command: `vspec merge resolve ${result.mergeRequest.id} --retry`,
              reason: "Retry after the failed conflict resolution."
            }
          ]
        )
      );
    case "MERGED":
      return reply.send(
        mergeResolveResponseSchema.parse({
          main_head_revision_ids: result.mainHeadRevisionIds,
          merge_request: result.mergeRequest,
          new_revisions: result.newRevisions,
          source_branch: result.sourceBranch,
          suggested_next_actions: result.suggestedNextActions
        })
      );
  }
}
