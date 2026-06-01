import { describe, expect, test } from "vitest";
import {
  impactPreviewRequestSchema,
  impactPreviewResponseSchema
} from "../src/index.js";

describe("impact contracts", () => {
  test("request requires base_revision/entity_id and allows optional proposed change", () => {
    expect(
      impactPreviewRequestSchema.parse({
        base_revision: "rev-1",
        entity_id: "uc-1",
        entity_type: "USECASE"
      })
    ).toEqual({
      base_revision: "rev-1",
      entity_id: "uc-1",
      entity_type: "USECASE"
    });

    expect(
      impactPreviewRequestSchema.parse({
        base_revision: "rev-1",
        entity_id: "uc-1",
        entity_type: "USECASE",
        proposed_change_content: "# UC",
        proposed_change_path: "uc.md"
      }).proposed_change_path
    ).toBe("uc.md");

    expect(() =>
      impactPreviewRequestSchema.parse({
        base_revision: "",
        entity_id: "uc-1",
        entity_type: "USECASE"
      })
    ).toThrow();
    expect(() =>
      impactPreviewRequestSchema.parse({
        base_revision: "rev-1",
        entity_id: "uc-1",
        entity_type: "ACTOR"
      })
    ).toThrow();
  });

  test("response parses preview payload with partially-populated sessions", () => {
    const parsed = impactPreviewResponseSchema.parse({
      cached: false,
      impact: {
        affected_branches: ["main"],
        affected_sessions: [
          {
            agent_type: "human",
            id: "session-1",
            owner: "user-1",
            pinned_revision: "rev-1",
            reason: "의존 UC의 계약 변경"
          },
          { agent_type: "agent", id: "session-2" }
        ],
        affected_tests: ["UC-001"],
        confidence: 0.9,
        input_hash: "hash-1",
        severity: "BREAKING"
      },
      preview_id: "preview-1",
      suggested_next_actions: [
        { command: "vspec change commit --preview-id preview-1", reason: "Commit" }
      ]
    });
    expect(parsed.impact.affected_sessions[1]?.owner).toBeUndefined();
    expect(parsed.preview_id).toBe("preview-1");
  });
});
