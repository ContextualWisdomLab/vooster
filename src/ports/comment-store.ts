import type { StoredComment } from "../http/comment-types.js";

export type CommentStore = {
  deleteComment: (commentId: string) => Promise<void>;
  findCommentById: (commentId: string) => Promise<StoredComment | undefined>;
  listCommentsForUseCase: (usecaseId: string) => Promise<StoredComment[]>;
  saveComment: (comment: StoredComment) => Promise<void>;
  updateComment: (comment: StoredComment) => Promise<void>;
};
