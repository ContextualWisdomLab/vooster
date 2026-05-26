import { describe, expect, test } from "vitest";
import {
  changeCommitRequestSchema,
  changeCommitResponseSchema,
  changePreviewRequestSchema,
  changePreviewResponseSchema,
  changeTestPreviewExpireParamsSchema
} from "../src/index.js";

describe("change contracts", () => {
  test("parses preview and commit request boundaries", () => {
    expect(
      changePreviewRequestSchema.parse({
        auto_commit: true,
        base_revision: "revision-base",
        patch: {
          entity_id: "usecase-1",
          entity_type: "USECASE",
          fields: { title: "Reviews a refund" }
        },
        usecase_key: "CHG-001"
      })
    ).toEqual({
      auto_commit: true,
      base_revision: "revision-base",
      patch: {
        entity_id: "usecase-1",
        entity_type: "USECASE",
        fields: { title: "Reviews a refund" }
      },
      usecase_key: "CHG-001"
    });
    expect(
      changeCommitRequestSchema.parse({
        confirmed: true,
        preview_id: "preview-1"
      })
    ).toEqual({ confirmed: true, preview_id: "preview-1" });
    expect(
      changeTestPreviewExpireParamsSchema.parse({ previewId: "preview-1" })
    ).toEqual({ previewId: "preview-1" });
  });

  test("rejects malformed change request boundaries", () => {
    expect(() =>
      changePreviewRequestSchema.parse({
        base_revision: "",
        patch: {
          entity_id: "usecase-1",
          entity_type: "USECASE",
          fields: { title: "Reviews a refund" }
        },
        usecase_key: "CHG-001"
      })
    ).toThrow();
    expect(() =>
      changePreviewRequestSchema.parse({
        base_revision: "revision-base",
        patch: {
          entity_id: "usecase-1",
          entity_type: "GOAL",
          fields: { title: "Reviews a refund" }
        },
        usecase_key: "CHG-001"
      })
    ).toThrow();
    expect(() => changeCommitRequestSchema.parse({ preview_id: "" })).toThrow();
    expect(() =>
      changeTestPreviewExpireParamsSchema.parse({ previewId: "" })
    ).toThrow();
  });

  test("parses preview and commit success responses", () => {
    const preview = changePreviewResponseSchema.parse({
      diff: [
        {
          after: "Reviews a refund",
          before: "Reviews an order",
          entity_id: "usecase-1",
          entity_type: "USECASE",
          path: "title",
          severity: "NON_BREAKING"
        }
      ],
      expires_at: "2026-05-22T00:15:00.000Z",
      impact: {
        affected_sessions: [
          {
            agent_type: "CODEX",
            id: "session-1",
            owner: "user-1",
            pinned_usecase_keys: ["CHG-001"]
          }
        ],
        severity: "NON_BREAKING"
      },
      preview_id: "preview-1",
      severity: "NON_BREAKING",
      suggested_next_actions: [
        {
          command: "vspec change commit --preview-id preview-1",
          reason: "Commit the preview after human review."
        }
      ],
      warnings: [{ message: "Review impacted sessions.", type: "IMPACT" }]
    });
    expect(preview.diff[0]?.entity_id).toBe("usecase-1");
    expect(preview.impact.affected_sessions[0]?.pinned_usecase_keys).toEqual([
      "CHG-001"
    ]);

    const commit = changeCommitResponseSchema.parse({
      revisions: [{ entity_id: "usecase-1", revision_id: "revision-1" }],
      suggested_next_actions: [
        { command: "vspec history CHG-001", reason: "Review the committed revision." }
      ]
    });
    expect(commit.revisions[0]?.revision_id).toBe("revision-1");
  });
});
