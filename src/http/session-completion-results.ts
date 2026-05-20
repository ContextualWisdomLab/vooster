import type { FastifyReply } from "fastify";
import type { CompleteSessionResult } from "../application/session-completion.js";
import { problem } from "./signup-support.js";

export function sendCompleteSessionResult(
  reply: FastifyReply,
  result: CompleteSessionResult
) {
  switch (result.status) {
    case "SESSION_NOT_FOUND":
      return reply.code(404).send(problem(404, "Session not found"));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "SESSION_NOT_ACTIVE":
      return reply.code(409).send(
        problem(
          409,
          "Session is not active",
          { current_status: result.currentStatus },
          [
            {
              command: `vspec session show ${result.sessionId}`,
              reason: "Inspect the current session state before retrying."
            }
          ]
        )
      );
    case "COMPLETION_FAILED":
      return reply.code(500).send(
        problem(500, "Session completion failed", { exit_code: result.exitCode }, [
          {
            command: "vspec session complete --retry",
            reason: "Retry the failed completion."
          }
        ])
      );
    case "COMPLETED":
      return reply.send({
        session: result.session,
        released_lock_ids: result.releasedLockIds,
        ...(result.warnings.length === 0 ? {} : { warnings: result.warnings }),
        ...(result.mergeRequest === undefined
          ? {}
          : { merge_request: result.mergeRequest }),
        session_file: { path: ".vspec/session.json", cleared: true },
        suggested_next_actions: result.suggestedNextActions
      });
  }
}
