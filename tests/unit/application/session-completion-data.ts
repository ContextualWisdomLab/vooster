import type { StoredMergeRequest } from "../../../src/domain/entities/index.js";
import type {
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";

export function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    branch_id: "branch-agent",
    id: "session-1",
    last_activity_at: "2026-05-20T00:00:00.000Z",
    pinned_revisions: { "usecase-1": "revision-1" },
    project_id: "project-1",
    started_at: "2026-05-20T00:00:00.000Z",
    status: "ACTIVE",
    user_id: "user-1",
    ...overrides
  };
}

export function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-06-01T00:00:00.000Z",
    holder: "session-1",
    id: "lock-1",
    mode: "SEMANTIC",
    reason: "Session owns semantic edits.",
    usecase_id: "usecase-1",
    ...overrides
  };
}

export function branch(overrides: Partial<StoredSpecBranch> = {}): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    id: "branch-agent",
    name: "agent/session-complete",
    owner_id: "session-1",
    owner_type: "AGENT",
    project_id: "project-1",
    status: "ACTIVE",
    ...overrides
  };
}

export function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "CMP",
    name: "Complete",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
  };
}

export function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-2",
    workspace_id: "workspace-1"
  };
}

export function mergeRequest(): StoredMergeRequest {
  return {
    conflicts: [],
    created_by: "user-1",
    current_revision_id: "id-2",
    id: "id-1",
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: { "usecase-1": "NON_BREAKING" }
    },
    source_branch_id: "branch-agent",
    status: "OPEN",
    strategy: "FAST_FORWARD",
    target_branch_id: "branch-main"
  };
}
