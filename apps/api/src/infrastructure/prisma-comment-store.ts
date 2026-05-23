import type { PrismaClient } from "@prisma/client";

import type { StoredComment } from "../domain/entities/index.js";
import type { CommentStore } from "../ports/comment-store.js";
import { commentData, commentUpdate, storedComment } from "./prisma-signup-mappers.js";

export function createPrismaCommentStore(prisma: PrismaClient): CommentStore {
  return new PrismaCommentStore(prisma);
}

class PrismaCommentStore implements CommentStore {
  constructor(private readonly prisma: PrismaClient) {}

  async deleteComment(commentId: string): Promise<void> {
    await this.prisma.comment.deleteMany({
      where: { id: commentId }
    });
  }

  async findCommentById(commentId: string): Promise<StoredComment | undefined> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId }
    });

    return comment === null ? undefined : storedComment(comment);
  }

  async listCommentsForUseCase(usecaseId: string): Promise<StoredComment[]> {
    const comments = await this.prisma.comment.findMany({
      orderBy: { created_at: "asc" },
      where: { target_id: usecaseId, target_type: "USECASE" }
    });

    return comments.map(storedComment);
  }

  async saveComment(comment: StoredComment): Promise<void> {
    await this.prisma.comment.create({ data: commentData(comment) });
  }

  async updateComment(comment: StoredComment): Promise<void> {
    await this.prisma.comment.update({
      data: commentUpdate(comment),
      where: { id: comment.id }
    });
  }
}
