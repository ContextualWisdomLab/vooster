import type { FastifyReply } from "fastify";
import type { CommentCommandResult } from "../application/comments.js";
import type { StoredComment } from "../domain/entities/index.js";
import {
  commentWriteFailedProblem,
  emptyBodyProblem,
  missingUseCaseProblem,
  notOwnerProblem
} from "./comment-problems.js";
import { problem } from "./signup-support.js";
import type { StoredUseCase } from "../domain/entities/index.js";

export function sendCommentResult(reply: FastifyReply, result: CommentCommandResult) {
  switch (result.status) {
    case "ADDED":
      return reply.code(201).send(commentResponse(result.comment, result.usecase));
    case "COMMENT_NOT_FOUND":
      return reply.code(404).send(problem(404, "Comment not found"));
    case "DELETED":
    case "UPDATED":
      return reply.send(commentResponse(result.comment, result.usecase));
    case "EMPTY_BODY":
      return reply.code(422).send(emptyBodyProblem());
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "LISTED":
      return reply.send({ comments: result.comments });
    case "NOT_OWNER":
      return reply.code(403).send(notOwnerProblem());
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(missingUseCaseProblem());
    case "WRITE_FAILED":
      return reply.code(500).send(commentWriteFailedProblem());
  }
}

function commentResponse(comment: StoredComment, usecase: StoredUseCase) {
  return {
    comment,
    suggested_next_actions: [
      {
        command: `vspec comment list ${usecase.key}`,
        reason: "Review open comments for this use case."
      },
      {
        command: `vspec usecase show ${usecase.key}`,
        reason: "Open the commented use case."
      }
    ]
  };
}
