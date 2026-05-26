import { describe, expect, test } from "vitest";
import {
  branchCreateRequestSchema,
  branchCreateResponseSchema,
  branchProjectParamsSchema
} from "../src/index.js";

describe("branch contracts", () => {
  test("parses project params and create request defaults", () => {
    expect(branchProjectParamsSchema.parse({ projectId: "project-1" })).toEqual({
      projectId: "project-1"
    });
    expect(branchCreateRequestSchema.parse({ name: "feature/refund-review" })).toEqual({
      from: "main",
      name: "feature/refund-review",
      simulate_snapshot_failure: false
    });
    expect(
      branchCreateRequestSchema.parse({
        from: "main",
        name: "feature/refund-review",
        simulate_snapshot_failure: true
      }).simulate_snapshot_failure
    ).toBe(true);
  });

  test("rejects malformed branch request boundaries", () => {
    expect(() => branchProjectParamsSchema.parse({ projectId: "" })).toThrow();
    expect(() => branchCreateRequestSchema.parse({ name: "" })).toThrow();
  });

  test("parses created branch responses", () => {
    const body = branchCreateResponseSchema.parse({
      branch: {
        base_branch_id: "branch-main",
        base_revision_ids: { "usecase-1": "revision-1" },
        head_revision_ids: { "usecase-1": "revision-1" },
        id: "branch-1",
        name: "feature/refund-review",
        owner_id: "user-1",
        owner_type: "HUMAN",
        project_id: "project-1",
        status: "ACTIVE"
      },
      suggested_next_actions: [
        {
          command: "vspec branch checkout feature/refund-review",
          reason: "Switch to the isolated branch."
        }
      ],
      warnings: [
        {
          merge_request_id: "merge-1",
          type: "IN_FLIGHT_MERGE_REQUEST"
        }
      ]
    });

    expect(body.branch.base_revision_ids["usecase-1"]).toBe("revision-1");
    expect(body.warnings?.[0]?.type).toBe("IN_FLIGHT_MERGE_REQUEST");
  });
});
