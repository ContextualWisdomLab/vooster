import type {
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";

export function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "ARC-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Reviews archive behavior",
    ...overrides
  };
}

export function hardLock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-20T01:00:00.000Z",
    held_by_session_id: "session-lock",
    holder: "session-lock",
    id: "lock-1",
    mode: "HARD",
    reason: "Archive boundary is locked.",
    usecase_id: "usecase-1",
    ...overrides
  };
}

export function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    id: "session-1",
    pinned_revisions: { "usecase-1": "revision-current" },
    status: "ACTIVE",
    usecase_id: "usecase-1",
    user_id: "user-1",
    ...overrides
  };
}

export function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "ARC",
    name: "Archive",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

export function mainBranch(): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: { "usecase-1": "revision-current" },
    id: "branch-main",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
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
