import { describe, expect, test } from "vitest";
import {
  addComment,
  deleteComment,
  listComments,
  patchComment
} from "../../../src/application/comments.js";
import type { StoredComment } from "../../../src/domain/entities/index.js";
import type {
  StoredMembership,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { CommentStore } from "../../../src/ports/comment-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("comments application", () => {
  test("adds, lists, edits, resolves, and deletes an owned comment", async () => {
    const comments: StoredComment[] = [];
    const deps = depsFor({ comments });

    const added = await addComment(deps, {
      body: "**Review** this flow",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(added.status).toBe("ADDED");
    if (added.status !== "ADDED") {
      throw new Error("expected comment to be added");
    }
    expect(added.comment).toEqual({
      author_id: "user-1",
      body: "**Review** this flow",
      created_at: "2026-05-20T00:00:00.000Z",
      id: "id-1",
      resolved: false,
      resolved_at: null,
      target_id: "usecase-1",
      target_type: "USECASE",
      updated_at: null
    });

    await expect(
      listComments(deps, { usecaseId: "usecase-1", userId: "user-1" })
    ).resolves.toEqual({
      comments: [added.comment],
      status: "LISTED",
      usecase: usecase()
    });

    const edited = await patchComment(deps, {
      body: "_Resolved in spec._",
      commentId: "id-1",
      userId: "user-1"
    });
    expect(edited.status).toBe("UPDATED");
    if (edited.status !== "UPDATED") {
      throw new Error("expected comment to be edited");
    }
    expect(edited.comment.body).toBe("_Resolved in spec._");
    expect(edited.comment.updated_at).toBe("2026-05-20T00:00:00.000Z");

    const resolved = await patchComment(deps, {
      commentId: "id-1",
      resolved: true,
      userId: "user-1"
    });
    expect(resolved.status).toBe("UPDATED");
    if (resolved.status !== "UPDATED") {
      throw new Error("expected comment to be resolved");
    }
    expect(resolved.comment.resolved).toBe(true);
    expect(resolved.comment.resolved_at).toBe("2026-05-20T00:00:00.000Z");

    const resolvedAgain = await patchComment(deps, {
      commentId: "id-1",
      resolved: true,
      userId: "user-1"
    });
    expect(resolvedAgain).toEqual(resolved);

    const deleted = await deleteComment(deps, { commentId: "id-1", userId: "user-1" });

    expect(deleted).toEqual({
      comment: resolved.comment,
      status: "DELETED",
      usecase: usecase()
    });
    expect(comments).toEqual([]);
  });

  test("rejects missing or unauthorized comment targets without writing", async () => {
    const comments: StoredComment[] = [];

    await expect(
      addComment(depsFor({ comments, usecase: null }), {
        body: "Review this",
        usecaseId: "missing",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });

    await expect(
      addComment(depsFor({ comments, membership: null }), {
        body: "Review this",
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });

    expect(comments).toEqual([]);
  });

  test("rejects empty comment bodies and simulated write failures", async () => {
    const comments: StoredComment[] = [];
    const deps = depsFor({ comments });

    await expect(
      addComment(deps, { body: "   ", usecaseId: "usecase-1", userId: "user-1" })
    ).resolves.toEqual({ status: "EMPTY_BODY" });
    await expect(
      addComment(deps, {
        body: "Persist later",
        simulateWriteFailure: true,
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "WRITE_FAILED" });
    await expect(
      patchComment(depsFor({ comments: [comment()] }), {
        body: " ",
        commentId: "comment-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "EMPTY_BODY" });

    expect(comments).toEqual([]);
  });

  test("requires ownership before editing or deleting", async () => {
    const comments = [comment()];
    const deps = depsFor({
      comments,
      membership: { ...membership(), user_id: "user-2" }
    });

    await expect(
      patchComment(deps, { body: "Changed", commentId: "comment-1", userId: "user-2" })
    ).resolves.toEqual({ status: "NOT_OWNER" });
    await expect(
      deleteComment(deps, { commentId: "comment-1", userId: "user-2" })
    ).resolves.toEqual({ status: "NOT_OWNER" });

    expect(comments).toEqual([comment()]);
  });

  test("reports missing comments before mutations", async () => {
    const deps = depsFor({ comments: [] });

    await expect(
      patchComment(deps, { body: "Changed", commentId: "missing", userId: "user-1" })
    ).resolves.toEqual({ status: "COMMENT_NOT_FOUND" });
    await expect(
      deleteComment(deps, { commentId: "missing", userId: "user-1" })
    ).resolves.toEqual({ status: "COMMENT_NOT_FOUND" });
  });
});

function depsFor(
  options: {
    comments?: StoredComment[];
    membership?: StoredMembership | null;
    usecase?: StoredUseCase | null;
  } = {}
) {
  let nextId = 0;
  return {
    commentStore: commentStore(options.comments ?? []),
    idFactory: () => {
      nextId += 1;
      return `id-${String(nextId)}`;
    },
    membershipStore: membershipStore(options.membership),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    useCaseStore: useCaseStore(options.usecase)
  };
}

function commentStore(comments: StoredComment[]): CommentStore {
  return {
    deleteComment: (commentId) => {
      const index = comments.findIndex((item) => item.id === commentId);
      if (index >= 0) {
        comments.splice(index, 1);
      }
      return Promise.resolve();
    },
    findCommentById: (commentId) =>
      Promise.resolve(comments.find((item) => item.id === commentId)),
    listCommentsForUseCase: (usecaseId) =>
      Promise.resolve(comments.filter((item) => item.target_id === usecaseId)),
    saveComment: (newComment) => {
      comments.push(newComment);
      return Promise.resolve();
    },
    updateComment: (updatedComment) => {
      const index = comments.findIndex((item) => item.id === updatedComment.id);
      comments[index] = updatedComment;
      return Promise.resolve();
    }
  };
}

function membershipStore(
  foundMembership: StoredMembership | null | undefined
): MembershipStore {
  const resolvedMembership =
    foundMembership === undefined ? membership() : foundMembership;
  return {
    membershipForProject: () => Promise.resolve(resolvedMembership ?? undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function useCaseStore(foundUseCase: StoredUseCase | null | undefined): UseCaseStore {
  const resolvedUseCase = foundUseCase === undefined ? usecase() : foundUseCase;
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(
        resolvedUseCase === null
          ? undefined
          : {
              projectId: resolvedUseCase.project_id,
              usecase: resolvedUseCase
            }
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function comment(): StoredComment {
  return {
    author_id: "user-1",
    body: "Original body",
    created_at: "2026-05-20T00:00:00.000Z",
    id: "comment-1",
    resolved: false,
    resolved_at: null,
    target_id: "usecase-1",
    target_type: "USECASE",
    updated_at: null
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CMT-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Reviews comments"
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
