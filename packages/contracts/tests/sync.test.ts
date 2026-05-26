import { describe, expect, test } from "vitest";
import {
  syncProjectParamsSchema,
  syncPullRequestSchema,
  syncPullResponseSchema,
  syncPushRequestSchema,
  syncPushResponseSchema
} from "../src/index.js";

describe("sync contracts", () => {
  test("parses pull and push request boundaries", () => {
    expect(syncProjectParamsSchema.parse({ projectId: "project-1" })).toEqual({
      projectId: "project-1"
    });
    expect(syncPullRequestSchema.parse({})).toEqual({ branch: "main" });
    expect(
      syncPushRequestSchema.parse({
        branch: "feature/refund",
        dry_run: true,
        files: [
          {
            base_revision: "revision-1",
            content: "---\nrevision: revision-1\n---\n# Refund\n",
            path: "specs/PAY-001.md"
          }
        ],
        simulate_network_failure: true
      })
    ).toMatchObject({ branch: "feature/refund", dry_run: true });
  });

  test("rejects malformed sync request boundaries", () => {
    expect(() => syncProjectParamsSchema.parse({ projectId: "" })).toThrow();
    expect(() =>
      syncPushRequestSchema.parse({
        files: [
          {
            base_revision: "",
            content: "---\nrevision: revision-1\n---\n# Refund\n",
            path: "specs/PAY-001.md"
          }
        ]
      })
    ).toThrow();
    expect(() => syncPushRequestSchema.parse({ files: [] })).toThrow();
  });

  test("parses pull and push success responses", () => {
    const pull = syncPullResponseSchema.parse({
      cursor: "revision-2",
      files: [
        {
          content: "---\nrevision: revision-2\n---\n# Refund\n",
          path: "specs/PAY-001.md",
          revision: "revision-2"
        }
      ]
    });
    expect(pull.files[0]?.revision).toBe("revision-2");

    const push = syncPushResponseSchema.parse({
      cache: {
        entries: [
          {
            path: "specs/PAY-001.md",
            revision: "revision-3",
            status: "SYNCED"
          }
        ]
      },
      results: [
        {
          current_revision: "revision-3",
          impact: { entity_id: "usecase-1", severity: "BREAKING" },
          path: "specs/PAY-001.md",
          status: "OK"
        }
      ],
      suggested_next_actions: [
        {
          command: "vspec pull",
          reason: "Refresh local files after successful push."
        }
      ]
    });
    expect(push.cache.entries[0]?.status).toBe("SYNCED");
  });
});
