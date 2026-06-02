import { describe, expect, test } from "vitest";
import type {
  StoredRevision,
  StoredStep,
  StoredWorkSession
} from "../../src/domain/entities/index.js";
import {
  mergeRequestData,
  revisionContentHash,
  stepData,
  stepUpdate,
  storedMergeRequest,
  storedRevision,
  storedStep,
  storedWorkSession,
  workSessionData,
  workSessionUpdate
} from "../../src/infrastructure/prisma-signup-mappers.js";

describe("prisma signup mappers", () => {
  test("normalizes legacy and malformed merge request payloads", () => {
    const legacy = storedMergeRequest({
      conflicts: JSON.stringify({ field: "title" }),
      created_by: "user-1",
      id: "merge-1",
      impact: JSON.stringify(["legacy"]),
      resolved_at: null,
      source_branch_id: "branch-feature",
      status: "UNKNOWN",
      strategy: "MERGE",
      target_branch_id: "branch-main"
    });
    const partiallyInvalid = storedMergeRequest({
      conflicts: JSON.stringify([{ field: "title" }, "invalid"]),
      created_by: "user-1",
      id: "merge-2",
      impact: JSON.stringify({
        current_revision_id: 42,
        impact: {
          affected_branches: ["branch-1", 5],
          affected_sessions: "bad",
          severity_by_entity: ["bad"]
        }
      }),
      resolved_at: new Date("2026-05-23T10:00:00Z"),
      source_branch_id: "branch-feature",
      status: "MERGED",
      strategy: "SQUASH",
      target_branch_id: "branch-main"
    });

    expect(legacy).toMatchObject({
      conflicts: [],
      impact: {
        affected_branches: [],
        affected_sessions: [],
        severity_by_entity: {}
      },
      status: "OPEN",
      strategy: "FAST_FORWARD"
    });
    expect(partiallyInvalid).toMatchObject({
      conflicts: [{ field: "title" }],
      current_revision_id: undefined,
      impact: {
        affected_branches: ["branch-1"],
        affected_sessions: [],
        severity_by_entity: {}
      },
      resolved_at: "2026-05-23T10:00:00.000Z",
      status: "MERGED",
      strategy: "SQUASH"
    });
    expect(mergeRequestData({ ...legacy, created_by: undefined })).toMatchObject({
      created_by: "",
      source_branch_id: "branch-feature"
    });
  });

  test("normalizes work sessions and serializes default fields", () => {
    const stored = storedWorkSession({
      agent_identifier: null,
      agent_type: "UNKNOWN",
      branch_id: null,
      ended_at: null,
      id: "session-1",
      intent: "Work on checkout",
      last_activity_at: null,
      pinned_revisions: "[]",
      project_id: "project-1",
      started_at: new Date("2026-05-23T10:00:00Z"),
      status: "ABANDONED",
      user_id: "user-1"
    });
    const minimal: StoredWorkSession = {
      id: "session-2",
      project_id: "project-1",
      status: "ACTIVE",
      user_id: "user-1"
    };

    expect(stored).toMatchObject({
      agent_identifier: undefined,
      agent_type: "OTHER",
      ended_at: undefined,
      last_activity_at: undefined,
      pinned_revisions: {},
      status: "ABANDONED"
    });
    expect(workSessionData(minimal)).toMatchObject({
      agent_identifier: null,
      agent_type: "OTHER",
      branch_id: null,
      ended_at: null,
      intent: "",
      last_activity_at: null,
      pinned_revisions: "{}",
      started_at: undefined
    });
    expect(workSessionUpdate(minimal)).toMatchObject({
      agent_identifier: null,
      agent_type: "OTHER",
      branch_id: null,
      ended_at: null,
      intent: "",
      last_activity_at: null,
      pinned_revisions: "{}",
      started_at: undefined
    });
    expect(() => workSessionData({ id: "missing", status: "ACTIVE" })).toThrow(
      "requires project_id and user_id"
    );
  });

  test("rejects unknown revision entity types", () => {
    expect(() =>
      storedRevision({
        branch_id: "branch-main",
        change_summary: null,
        entity_id: "entity-1",
        entity_type: "UNKNOWN",
        id: "revision-1",
        parent_revision_id: null,
        severity: null,
        snapshot: "{}",
        version_number: 1
      })
    ).toThrow("Unknown revision entity type UNKNOWN");
  });

  test("carries step implementation links through persistence mappers and hashes", () => {
    const stored = storedStep({
      action: "Logs the user in.",
      actor_id: "actor-1",
      id: "step-1",
      implements: ["tests/UC-013.feature:scenario_login", "src/auth/login.ts"],
      invokes: ["AUTH-002"],
      is_system_step: false,
      notes: null,
      order_index: 1,
      scenario_id: "scenario-1",
      step_number: 1
    });

    expect(stored.implements).toEqual([
      "tests/UC-013.feature:scenario_login",
      "src/auth/login.ts"
    ]);
    expect(stepData(stored).implements).toEqual(stored.implements);
    expect(stepUpdate(stored).implements).toEqual(stored.implements);
    expect(hashFor(step({ implements: [] }))).not.toBe(hashFor(stored));
  });
});

function hashFor(step: StoredStep) {
  return revisionContentHash({
    change_summary: "Snapshot",
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    severity: "COSMETIC",
    snapshot: { steps: [step] },
    version_number: 1
  } as unknown as StoredRevision);
}

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Logs the user in.",
    actor_id: "actor-1",
    id: "step-1",
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 1,
    scenario_id: "scenario-1",
    step_number: 1,
    ...overrides,
    implements: overrides.implements ?? []
  };
}
