import { describe, expect, test } from "vitest";
import {
  revisionDiffQuerySchema,
  revisionDiffResponseSchema,
  revisionHistoryQuerySchema,
  revisionHistoryResponseSchema,
  revisionRevertRequestSchema,
  revisionRevertResponseSchema,
  revisionUsecaseParamsSchema
} from "../src/index.js";

describe("revision contracts", () => {
  test("parses history, diff, and revert request boundaries", () => {
    expect(revisionUsecaseParamsSchema.parse({ usecaseId: "usecase-1" })).toEqual({
      usecaseId: "usecase-1"
    });
    expect(revisionHistoryQuerySchema.parse({ limit: "20" })).toMatchObject({
      limit: 20
    });
    expect(revisionHistoryQuerySchema.parse({})).toMatchObject({ limit: 50 });
    expect(
      revisionDiffQuerySchema.parse({
        format: "agent",
        from: "revision-1",
        to: "revision-2"
      })
    ).toEqual({ format: "agent", from: "revision-1", to: "revision-2" });
    expect(
      revisionRevertRequestSchema.parse({
        force: true,
        revision_id: "revision-1",
        simulate_gherkin_drift: true,
        simulate_write_failure: true,
        summary: "Restore known-good behavior."
      })
    ).toMatchObject({ force: true, revision_id: "revision-1" });
  });

  test("rejects malformed revision request boundaries", () => {
    expect(() => revisionUsecaseParamsSchema.parse({ usecaseId: "" })).toThrow();
    expect(() => revisionHistoryQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() =>
      revisionDiffQuerySchema.parse({
        format: "xml",
        from: "revision-1",
        to: "revision-2"
      })
    ).toThrow();
    expect(() => revisionRevertRequestSchema.parse({ revision_id: "" })).toThrow();
  });

  test("parses history, diff, and revert success responses", () => {
    const history = revisionHistoryResponseSchema.parse({
      limit: 10,
      revisions: [
        {
          author: "user-1",
          change_summary: "Created use case",
          entity_id: "usecase-1",
          entity_type: "USECASE",
          revision: "revision-2",
          timestamp: "2026-05-22T00:00:00.000Z",
          version_number: 2
        }
      ],
      suggested_next_actions: [
        {
          command: "vspec usecase show HIS-001 --revision=revision-2",
          reason: "Inspect it."
        }
      ],
      suppressed_count: 0,
      truncated: false,
      usecase: { key: "HIS-001" }
    });
    expect(history.revisions[0]?.revision).toBe("revision-2");

    const diff = revisionDiffResponseSchema.parse({
      changes: [
        {
          change_type: "UPDATE",
          entity_type: "STEP",
          path: "main_success.steps[2]",
          revision: "revision-2",
          severity: "NON_BREAKING"
        }
      ],
      format: "json",
      from_revision: "revision-1",
      suggested_next_actions: [
        {
          command: "vspec revert PAY-001 --to revision-1",
          reason: "Restore the earlier revision if this change is not wanted."
        }
      ],
      summary: { breaking: 0, cosmetic: 0, non_breaking: 1 },
      to_revision: "revision-2",
      usecase: { key: "PAY-001" }
    });
    expect(diff.summary.non_breaking).toBe(1);

    const reverted = revisionRevertResponseSchema.parse({
      impact: {
        affected_branches: [],
        affected_sessions: [],
        severity: "NON_BREAKING"
      },
      revision: {
        change_summary: "Revert to revision-1",
        id: "revision-revert",
        parent_revision_id: "revision-2",
        severity: "NON_BREAKING",
        version_number: 3
      },
      suggested_next_actions: [
        { command: "vspec history REV-001", reason: "Review revert history." }
      ],
      usecase: {
        current_revision_id: "revision-revert",
        id: "usecase-1",
        title: "Reviews a refund"
      },
      warnings: [{ message: "Pinned feature files drift.", type: "GHERKIN_DRIFT" }]
    });
    expect(reverted.revision.id).toBe("revision-revert");
  });
});
