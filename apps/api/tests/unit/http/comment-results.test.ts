import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { CommentCommandResult } from "../../../src/application/comments.js";
import type {
  StoredComment,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { sendCommentResult } from "../../../src/http/comment-results.js";

describe("comment result responses", () => {
  test("serializes added, updated, and deleted comments with next actions", () => {
    const cases: Array<{
      expectedStatus?: number;
      result: CommentCommandResult;
    }> = [
      {
        expectedStatus: 201,
        result: { comment: comment(), status: "ADDED", usecase: usecase() }
      },
      {
        result: {
          comment: comment({ body: "Updated" }),
          status: "UPDATED",
          usecase: usecase()
        }
      },
      {
        result: {
          comment: comment({ resolved: true }),
          status: "DELETED",
          usecase: usecase()
        }
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCommentResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({
        suggested_next_actions: [
          { command: "vspec comment list CMT-001" },
          { command: "vspec usecase show CMT-001" }
        ]
      });
    }
  });

  test("serializes listed comments", () => {
    const captured = reply();
    const comments = [comment()];

    sendCommentResult(captured.fastifyReply, {
      comments,
      status: "LISTED",
      usecase: usecase()
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toEqual({ comments });
  });

  test("serializes comment failures", () => {
    const cases: Array<{
      expectedStatus: number;
      result: CommentCommandResult;
      title: string;
    }> = [
      {
        expectedStatus: 404,
        result: { status: "COMMENT_NOT_FOUND" },
        title: "Comment not found"
      },
      {
        expectedStatus: 422,
        result: { status: "EMPTY_BODY" },
        title: "empty_body"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 403,
        result: { status: "NOT_OWNER" },
        title: "Only the comment author can change this comment"
      },
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" },
        title: "Use case not found"
      },
      {
        expectedStatus: 500,
        result: { status: "WRITE_FAILED" },
        title: "Comment write failed"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCommentResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function comment(overrides: Partial<StoredComment> = {}): StoredComment {
  return {
    author_id: "user-1",
    body: "Original body",
    created_at: "2026-05-20T00:00:00.000Z",
    id: "comment-1",
    resolved: false,
    resolved_at: null,
    target_id: "usecase-1",
    target_type: "USECASE",
    updated_at: null,
    ...overrides
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
