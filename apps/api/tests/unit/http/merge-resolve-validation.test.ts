import { describe, expect, test } from "vitest";
import type {
  StoredLock,
  StoredMergeRequest,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import {
  hardLockResolutionProblem,
  manualResolutionMissingValue,
  missingManualValueProblem,
  resolutionWriteFailureProblem,
  staleBaseProblem,
  uncoveredConflicts,
  uncoveredConflictsProblem
} from "../../../src/http/merge-resolve-validation.js";

const signupState: SignupState = {
  pendingOAuth: new Map(),
  readOnlyMemberships: new Set(),
  sessionsByToken: new Map()
};

describe("merge resolve validation", () => {
  test("finds manual resolutions without explicit values", () => {
    expect(
      manualResolutionMissingValue([
        { entity_id: "goal-1", strategy: "THEIRS" },
        { entity_id: "goal-2", strategy: "MANUAL", value: null },
        { entity_id: "goal-3", strategy: "MANUAL" }
      ])
    ).toEqual({ entity_id: "goal-3", strategy: "MANUAL" });
  });

  test("returns conflicts not covered by the submitted resolutions", () => {
    const conflicts = [
      { entity_id: "goal-1", field: "description" },
      { entity_id: 42, field: "title" }
    ];

    expect(
      uncoveredConflicts(conflicts, [{ entity_id: "goal-1", strategy: "OURS" }])
    ).toEqual([{ entity_id: 42, field: "title" }]);
  });

  test("serializes stale base, manual value, and uncovered conflict problems", () => {
    const merge = mergeRequest();

    expect(staleBaseProblem(merge)).toMatchObject({
      conflicts: merge.conflicts,
      current_revision: "revision-current",
      status: 409,
      title: "Merge request base revision is stale"
    });
    expect(
      missingManualValueProblem(merge, {
        entity_id: "goal-1",
        field: "description",
        strategy: "MANUAL"
      })
    ).toMatchObject({
      field: "description",
      offending_entity_id: "goal-1",
      status: 400,
      title: "Manual resolution requires a value"
    });
    expect(uncoveredConflictsProblem(merge, [{ entity_id: "goal-2" }])).toMatchObject({
      status: 422,
      title: "Resolution list must cover every conflict",
      uncovered_conflicts: [{ entity_id: "goal-2" }]
    });
  });

  test("uses the use case key when reporting hard lock resolution conflicts", async () => {
    const problem = await hardLockResolutionProblem(
      signupState,
      useCaseStore(storedUseCase()),
      mergeRequest(),
      { "goal-1": "revision-main" },
      lock({ usecase_id: "usecase-1" })
    );

    expect(problem).toMatchObject({
      holding_session: "session-2",
      main_head_revision_ids: { "goal-1": "revision-main" },
      status: 409,
      suggested_next_actions: [
        {
          command: "vspec who PAY-001",
          reason: "Inspect the session holding the hard lock."
        }
      ],
      title: "Target entity has a hard lock"
    });
  });

  test("falls back to the use case id when a hard lock target cannot be resolved", async () => {
    const problem = await hardLockResolutionProblem(
      signupState,
      useCaseStore(undefined),
      mergeRequest(),
      {},
      lock({ usecase_id: "missing-usecase" })
    );

    expect(problem.suggested_next_actions).toEqual([
      {
        command: "vspec who missing-usecase",
        reason: "Inspect the session holding the hard lock."
      }
    ]);
  });

  test("serializes conflict resolution write failures", () => {
    const merge = mergeRequest();
    const source = specBranch();

    expect(
      resolutionWriteFailureProblem(merge, source, { goal: "revision-main" })
    ).toMatchObject({
      exit_code: 5,
      main_head_revision_ids: { goal: "revision-main" },
      merge_request: merge,
      source_branch: source,
      status: 500,
      title: "Conflict resolution write failed"
    });
  });
});

function mergeRequest(): StoredMergeRequest {
  return {
    conflicts: [{ entity_id: "goal-1", field: "description" }],
    current_revision_id: "revision-current",
    id: "merge-1",
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: {}
    },
    source_branch_id: "branch-source",
    status: "OPEN",
    strategy: "SQUASH",
    target_branch_id: "branch-main"
  };
}

function specBranch(): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    id: "branch-source",
    name: "feature/conflict",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-2",
    held_by_user_id: "user-2",
    holder: "session-2",
    mode: "HARD",
    reason: "Resolve conflict",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function storedUseCase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order"
  };
}

function useCaseStore(usecase: StoredUseCase | undefined): UseCaseStore {
  return {
    findUseCaseWithProject: () =>
      Promise.resolve(
        usecase === undefined ? undefined : { projectId: usecase.project_id, usecase }
      )
  } as unknown as UseCaseStore;
}
