import type { CommentPayload, CommentResponse } from "@vooster/contracts";

export function printCommentResponse(
  body: CommentResponse,
  writeLine: (message: string) => void
): void {
  printComment(body.comment, writeLine);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

export function printComment(
  comment: CommentPayload,
  writeLine: (message: string) => void
): void {
  writeLine(`Comment ${comment.id}`);
  writeLine(`Target ${comment.target_id}`);
  writeLine(`Author ${comment.author_id}`);
  writeLine(`Resolved ${String(comment.resolved)}`);
  writeLine(`Resolved at ${comment.resolved_at ?? ""}`);
  writeLine(`Updated at ${comment.updated_at ?? ""}`);
  writeLine(`Body ${comment.body}`);
}
