import { describe, expect, test } from "vitest";
import {
  commentAddQuerySchema,
  commentBodySchema,
  commentIdParamsSchema,
  commentListResponseSchema,
  commentPatchSchema,
  commentResponseSchema,
  usecaseCommentParamsSchema
} from "../src/index.js";

describe("comment contracts", () => {
  test("parses comment request boundaries", () => {
    expect(commentBodySchema.parse({ body: "Review this flow." })).toEqual({
      body: "Review this flow."
    });
    expect(
      commentBodySchema.parse({
        body: "Review this flow.",
        simulate_write_failure: true
      })
    ).toEqual({
      body: "Review this flow.",
      simulate_write_failure: true
    });
    expect(commentPatchSchema.parse({ body: "Addressed." })).toEqual({
      body: "Addressed."
    });
    expect(commentPatchSchema.parse({ resolved: true })).toEqual({
      resolved: true
    });
    expect(usecaseCommentParamsSchema.parse({ usecaseId: "CMT-001" })).toEqual({
      usecaseId: "CMT-001"
    });
    expect(commentIdParamsSchema.parse({ commentId: "comment-1" })).toEqual({
      commentId: "comment-1"
    });
    expect(commentAddQuerySchema.parse({ dry_run: "true" })).toBe(true);
    expect(commentAddQuerySchema.parse(null)).toBe(false);
  });

  test("rejects malformed comment request boundaries", () => {
    expect(() => commentBodySchema.parse({ body: "" })).toThrow();
    expect(() => commentPatchSchema.parse({ resolved: false })).toThrow();
    expect(() => commentPatchSchema.parse({})).toThrow();
    expect(() => usecaseCommentParamsSchema.parse({ usecaseId: "" })).toThrow();
    expect(() => commentIdParamsSchema.parse({ commentId: "" })).toThrow();
  });

  test("parses comment success responses", () => {
    const response = commentResponseSchema.parse({
      comment: comment(),
      suggested_next_actions: [
        {
          command: "vspec comment list CMT-001",
          reason: "Review open comments for this use case."
        },
        {
          command: "vspec usecase show CMT-001",
          reason: "Open the commented use case."
        }
      ]
    });

    expect(response.comment.id).toBe("comment-1");
    expect(response.suggested_next_actions[0]?.command).toBe(
      "vspec comment list CMT-001"
    );
    expect(
      commentListResponseSchema.parse({ comments: [comment()] }).comments
    ).toHaveLength(1);
  });
});

function comment() {
  return {
    author_id: "user-1",
    body: "Review this flow.",
    created_at: "2026-05-22T00:00:00.000Z",
    id: "comment-1",
    resolved: false,
    resolved_at: null,
    target_id: "usecase-1",
    target_type: "USECASE",
    updated_at: null
  };
}
