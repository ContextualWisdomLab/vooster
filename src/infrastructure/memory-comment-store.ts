import type { StoredComment } from "../http/comment-types.js";
import type { CommentStore } from "../ports/comment-store.js";

export function createMemoryCommentStore(): CommentStore {
  const commentsById = new Map<string, StoredComment>();

  return {
    deleteComment(commentId) {
      commentsById.delete(commentId);
      return Promise.resolve();
    },

    findCommentById(commentId) {
      return Promise.resolve(commentsById.get(commentId));
    },

    listCommentsForUseCase(usecaseId) {
      return Promise.resolve(
        [...commentsById.values()].filter((comment) => comment.target_id === usecaseId)
      );
    },

    saveComment(comment) {
      commentsById.set(comment.id, comment);
      return Promise.resolve();
    },

    updateComment(comment) {
      commentsById.set(comment.id, comment);
      return Promise.resolve();
    }
  };
}
