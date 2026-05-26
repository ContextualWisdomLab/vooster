import type { FastifyReply } from "fastify";
import { mergeOpenResponseSchema } from "@vooster/contracts";
import type { OpenMergeResult } from "../application/merge-types.js";
import { problem } from "./signup-support.js";

export function sendOpenMergeResult(reply: FastifyReply, result: OpenMergeResult) {
  switch (result.status) {
    case "SOURCE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Source branch not found"));
    case "ACCESS_DENIED":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "SOURCE_NOT_ACTIVE":
      return reply.code(409).send(problem(409, "Source branch is not active"));
    case "FAST_FORWARD_REJECTED":
      return reply.code(422).send(
        problem(
          422,
          "Fast-forward rejected because main has advanced",
          {
            main_head_revision_ids: result.mainHeadRevisionIds,
            source_branch: result.sourceBranch
          },
          [
            {
              command: `vspec merge open ${result.sourceBranch.name} --strategy squash`,
              reason: "Retry with the safe squash strategy."
            }
          ]
        )
      );
    case "HARD_LOCK":
      return reply.code(409).send(
        problem(
          409,
          "Target entity has a hard lock",
          {
            holding_session: result.holdingSession,
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
    case "CONFLICTS":
      return reply.code(201).send(
        mergeOpenResponseSchema.parse({
          main_head_revision_ids: result.mainHeadRevisionIds,
          merge_request: result.mergeRequest,
          source_branch: result.sourceBranch,
          suggested_next_actions: [
            {
              command: `vspec merge resolve ${result.mergeRequest.id}`,
              reason: "Resolve conflicts before this branch can merge."
            }
          ]
        })
      );
    case "WRITE_FAILED":
      return reply.code(500).send(
        problem(
          500,
          "Merge write failed",
          {
            exit_code: result.exitCode,
            main_head_revision_ids: result.mainHeadRevisionIds,
            merge_request: result.mergeRequest,
            source_branch: result.sourceBranch
          },
          [
            {
              command: `vspec merge open ${result.sourceBranch.name} --retry`,
              reason: "Retry after the failed merge write."
            }
          ]
        )
      );
    case "MERGED":
      return reply.code(201).send(
        mergeOpenResponseSchema.parse({
          main_head_revision_ids: result.mainHeadRevisionIds,
          merge_request: result.mergeRequest,
          source_branch: result.sourceBranch,
          suggested_next_actions: [
            {
              command: `vspec merge show ${result.mergeRequest.id}`,
              reason: "Review the completed merge request."
            }
          ]
        })
      );
  }
}
