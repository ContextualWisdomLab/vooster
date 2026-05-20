import type { FastifyReply } from "fastify";
import type { ChangePreviewResult } from "../application/change-preview.js";
import { hardLockProblem, previews } from "./change-preview-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

export function sendChangePreviewResult(
  reply: FastifyReply,
  state: SignupState,
  result: ChangePreviewResult
) {
  switch (result.status) {
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "WRITE_FORBIDDEN":
      return reply.code(403).send(problem(403, "Write access required"));
    case "PATCH_TARGET_MISMATCH":
      return reply.code(400).send(problem(400, "Patch targets a different use case"));
    case "HARD_LOCKED":
      return reply.code(409).send(hardLockProblem(result.usecase, result.lock));
    case "STALE_BASE":
      return reply
        .code(409)
        .send(staleBaseProblem(result.usecase, result.currentRevision));
    case "PREVIEWED":
      previews(state).set(result.preview.id, result.preview);
      return reply.code(201).send({
        diff: result.preview.diff,
        expires_at: result.preview.expires_at,
        impact: {
          affected_sessions: result.affectedSessions,
          severity: result.preview.severity
        },
        preview_id: result.preview.id,
        severity: result.preview.severity,
        suggested_next_actions: result.suggestedNextActions,
        warnings: result.warnings
      });
  }
}

function staleBaseProblem(
  usecase: { current_revision_id: string; key: string },
  current: { severity?: "BREAKING" | "COSMETIC" | "NON_BREAKING" } | undefined
) {
  return problem(
    409,
    "Stale base revision",
    {
      current_revision: usecase.current_revision_id,
      impact: { affected_sessions: [], severity: current?.severity ?? "NON_BREAKING" }
    },
    [
      {
        command: `vspec usecase show ${usecase.key} --format=agent`,
        reason: "Re-read the current use case before proposing again."
      },
      {
        command: `vspec change propose ${usecase.key}`,
        reason: "Propose the change again against the fresh base revision."
      }
    ]
  );
}
