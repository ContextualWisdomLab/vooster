import type { StoredMergeRequest } from "../../../src/http/merge-request-types.js";
import type { StoredSpecBranch, StoredUseCase } from "../../../src/http/signup-types.js";

export function mainBranch(overrides: Partial<StoredSpecBranch> = {}): StoredSpecBranch {
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

export function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "MRG-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Reviews refunds",
    ...overrides
  };
}

export function mergeRequest(): StoredMergeRequest {
  return {
    conflicts: [],
    current_revision_id: "merge-current",
    id: "merge-1",
    impact: { affected_branches: [], affected_sessions: [], severity_by_entity: {} },
    source_branch_id: "branch-feature",
    status: "OPEN",
    strategy: "SQUASH",
    target_branch_id: "branch-main"
  };
}
