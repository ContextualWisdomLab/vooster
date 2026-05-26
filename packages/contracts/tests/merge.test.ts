import { describe, expect, test } from "vitest";
import {
  mergeOpenRequestSchema,
  mergeOpenResponseSchema,
  mergeResolveParamsSchema,
  mergeResolveRequestSchema,
  mergeResolveResponseSchema
} from "../src/index.js";

describe("merge contracts", () => {
  test("parses open and resolve request boundaries", () => {
    expect(
      mergeOpenRequestSchema.parse({
        simulate_write_failure: true,
        source_branch_id: "branch-1",
        strategy: "SQUASH",
        target: "main"
      })
    ).toEqual({
      simulate_write_failure: true,
      source_branch_id: "branch-1",
      strategy: "SQUASH",
      target: "main"
    });
    expect(
      mergeOpenRequestSchema.parse({ source_branch_id: "branch-1" })
    ).toMatchObject({ simulate_write_failure: false, target: "main" });
    expect(mergeResolveParamsSchema.parse({ mergeId: "merge-1" })).toEqual({
      mergeId: "merge-1"
    });
    expect(
      mergeResolveRequestSchema.parse({
        base_revision: "revision-1",
        resolutions: [
          {
            entity_id: "usecase-1",
            field: "title",
            strategy: "MANUAL",
            value: "Resolved title"
          }
        ],
        simulate_write_failure: true
      })
    ).toEqual({
      base_revision: "revision-1",
      resolutions: [
        {
          entity_id: "usecase-1",
          field: "title",
          strategy: "MANUAL",
          value: "Resolved title"
        }
      ],
      simulate_write_failure: true
    });
  });

  test("rejects malformed merge request boundaries", () => {
    expect(() => mergeOpenRequestSchema.parse({ source_branch_id: "" })).toThrow();
    expect(() =>
      mergeOpenRequestSchema.parse({
        source_branch_id: "branch-1",
        strategy: "REBASE"
      })
    ).toThrow();
    expect(() => mergeResolveParamsSchema.parse({ mergeId: "" })).toThrow();
    expect(() =>
      mergeResolveRequestSchema.parse({
        base_revision: "revision-1",
        resolutions: []
      })
    ).toThrow();
  });

  test("parses open and resolve success responses without dropping domain fields", () => {
    const opened = mergeOpenResponseSchema.parse({
      main_head_revision_ids: { "usecase-1": "revision-main" },
      merge_request: mergeRequest({ strategy: "SQUASH" }),
      source_branch: branch({ status: "ACTIVE" }),
      suggested_next_actions: [
        {
          command: "vspec merge resolve merge-1",
          reason: "Resolve conflicts before this branch can merge."
        }
      ]
    });
    expect(opened.merge_request.impact.severity_by_entity["usecase-1"]).toBe(
      "BREAKING"
    );

    const resolved = mergeResolveResponseSchema.parse({
      main_head_revision_ids: { "usecase-1": "revision-2" },
      merge_request: mergeRequest({ conflicts: [], status: "MERGED" }),
      new_revisions: [
        {
          entity_id: "usecase-1",
          id: "revision-2",
          snapshot: { title: "Resolved title" }
        }
      ],
      source_branch: branch({ status: "MERGED" }),
      suggested_next_actions: [
        { command: "vspec usecase show RSV-001", reason: "Review it." }
      ]
    });
    expect(resolved.new_revisions[0]?.snapshot).toEqual({
      title: "Resolved title"
    });
  });
});

function mergeRequest(overrides: Record<string, unknown> = {}) {
  return {
    conflicts: [{ entity_id: "usecase-1", field: "title" }],
    id: "merge-1",
    impact: { severity_by_entity: { "usecase-1": "BREAKING" } },
    status: "OPEN",
    strategy: "SQUASH",
    ...overrides
  };
}

function branch(overrides: Record<string, unknown> = {}) {
  return {
    id: "branch-1",
    name: "agent/merge-open",
    status: "ACTIVE",
    ...overrides
  };
}
