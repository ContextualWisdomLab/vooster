import { randomUUID } from "node:crypto";
import type { StoredComment } from "../domain/entities/index.js";
import type { StoredUseCase } from "../domain/entities/index.js";
import type { CommentStore } from "../ports/comment-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type CommentsDeps = {
  commentStore: CommentStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  now?: () => Date;
  useCaseStore: UseCaseStore;
};

export type CommentCommandResult =
  | { comment: StoredComment; status: "ADDED" | "DELETED" | "UPDATED"; usecase: StoredUseCase }
  | { comments: StoredComment[]; status: "LISTED"; usecase: StoredUseCase }
  | {
      status:
        | "COMMENT_NOT_FOUND"
        | "EMPTY_BODY"
        | "FORBIDDEN"
        | "NOT_OWNER"
        | "USECASE_NOT_FOUND"
        | "WRITE_FAILED";
    };

export async function addComment(
  deps: CommentsDeps,
  input: {
    body: string;
    dryRun?: boolean;
    simulateWriteFailure?: boolean;
    usecaseId: string;
    userId: string | undefined;
  }
): Promise<CommentCommandResult> {
  const found = await authorizedUseCase(deps, input.usecaseId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  if (input.body.trim() === "") {
    return { status: "EMPTY_BODY" };
  }
  if (input.simulateWriteFailure === true) {
    return { status: "WRITE_FAILED" };
  }

  const comment = {
    author_id: found.userId,
    body: input.body,
    created_at: now(deps),
    id: idFrom(deps),
    resolved: false,
    resolved_at: null,
    target_id: found.usecase.id,
    target_type: "USECASE" as const,
    updated_at: null
  };
  if (input.dryRun !== true) {
    await deps.commentStore.saveComment(comment);
  }
  return { comment, status: "ADDED", usecase: found.usecase };
}

export async function listComments(
  deps: CommentsDeps,
  input: { usecaseId: string; userId: string | undefined }
): Promise<CommentCommandResult> {
  const found = await authorizedUseCase(deps, input.usecaseId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  return {
    comments: await deps.commentStore.listCommentsForUseCase(found.usecase.id),
    status: "LISTED",
    usecase: found.usecase
  };
}

export async function patchComment(
  deps: CommentsDeps,
  input: {
    body?: string;
    commentId: string;
    resolved?: true;
    userId: string | undefined;
  }
): Promise<CommentCommandResult> {
  const found = await authorizedComment(deps, input.commentId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  if (found.comment.author_id !== found.userId) {
    return { status: "NOT_OWNER" };
  }
  if (input.body?.trim() === "") {
    return { status: "EMPTY_BODY" };
  }
  if (input.body !== undefined) {
    found.comment.body = input.body;
    found.comment.updated_at = now(deps);
  }
  if (input.resolved === true && !found.comment.resolved) {
    found.comment.resolved = true;
    found.comment.resolved_at = now(deps);
  }
  await deps.commentStore.updateComment(found.comment);
  return { comment: found.comment, status: "UPDATED", usecase: found.usecase };
}

export async function deleteComment(
  deps: CommentsDeps,
  input: { commentId: string; userId: string | undefined }
): Promise<CommentCommandResult> {
  const found = await authorizedComment(deps, input.commentId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  if (found.comment.author_id !== found.userId) {
    return { status: "NOT_OWNER" };
  }
  await deps.commentStore.deleteComment(found.comment.id);
  return { comment: found.comment, status: "DELETED", usecase: found.usecase };
}

async function authorizedUseCase(
  deps: CommentsDeps,
  usecaseId: string,
  userId: string | undefined
): Promise<
  | { status: "AUTHORIZED"; usecase: StoredUseCase; userId: string }
  | { status: "FORBIDDEN" | "USECASE_NOT_FOUND" }
> {
  const found = await deps.useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined || found.usecase.archived_at !== null) {
    return { status: "USECASE_NOT_FOUND" };
  }
  return userId !== undefined &&
    await deps.membershipStore.membershipForProject(found.projectId, userId) !== undefined
    ? { status: "AUTHORIZED", usecase: found.usecase, userId }
    : { status: "FORBIDDEN" };
}

async function authorizedComment(
  deps: CommentsDeps,
  commentId: string,
  userId: string | undefined
): Promise<
  | { comment: StoredComment; status: "AUTHORIZED"; usecase: StoredUseCase; userId: string }
  | { status: "COMMENT_NOT_FOUND" | "FORBIDDEN" }
> {
  const comment = await deps.commentStore.findCommentById(commentId);
  const found =
    comment === undefined
      ? undefined
      : await deps.useCaseStore.findUseCaseWithProject(comment.target_id);
  if (comment === undefined || found === undefined) {
    return { status: "COMMENT_NOT_FOUND" };
  }
  return userId !== undefined &&
    await deps.membershipStore.membershipForProject(found.projectId, userId) !== undefined
    ? { comment, status: "AUTHORIZED", usecase: found.usecase, userId }
    : { status: "FORBIDDEN" };
}

function idFrom(deps: CommentsDeps): string {
  return (deps.idFactory ?? randomUUID)();
}

function now(deps: CommentsDeps): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}
