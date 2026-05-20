import type { StoredMergeRequest } from "../../../src/http/merge-request-types.js";
import type {
  StoredLock,
  StoredMembership,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/http/signup-types.js";

export function mergeRequest(
  overrides: Partial<StoredMergeRequest> = {}
): StoredMergeRequest {
  return {
    conflicts: [
      {
        entity_id: "usecase-1",
        entity_type: "USECASE",
        field: "title",
        mine_value: "Source title",
        theirs_value: "Main title",
        type: "STRUCTURAL"
      }
    ],
    created_by: "user-1",
    current_revision_id: "merge-current",
    id: "merge-1",
    impact: { affected_branches: [], affected_sessions: [], severity_by_entity: {} },
    source_branch_id: "branch-feature",
    status: "OPEN",
    strategy: "SQUASH",
    target_branch_id: "branch-main",
    ...overrides
  };
}

export function featureBranch(
  overrides: Partial<StoredSpecBranch> = {}
): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    base_revision_ids: { "usecase-1": "revision-base" },
    head_revision_ids: { "usecase-1": "revision-source" },
    id: "branch-feature",
    name: "feature/refund",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE",
    ...overrides
  };
}

export function mainBranch(
  overrides: Partial<StoredSpecBranch> = {}
): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: { "usecase-1": "revision-main" },
    id: "branch-main",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE",
    ...overrides
  };
}

export function lock(): StoredLock {
  return {
    expires_at: "2026-06-01T00:00:00.000Z",
    holder: "session-lock-holder",
    mode: "HARD",
    reason: "Another session owns the target.",
    usecase_id: "usecase-1"
  };
}

export function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

export function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-main",
    format: "BRIEF",
    id: "usecase-1",
    key: "MRG-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Original title",
    ...overrides
  };
}
