export type CommentPayload = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  resolved: boolean;
  resolved_at: null | string;
  target_id: string;
  target_type: string;
  updated_at: null | string;
};

export type CommentResponse = {
  comment: CommentPayload;
  suggested_next_actions: Array<{
    command: string;
  }>;
};

export type CommentListResponse = {
  comments: CommentPayload[];
};

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
