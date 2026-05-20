import type {
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/http/signup-types.js";

export function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "REV-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "refunds",
    status: "DRAFT",
    title: "Reviews a refund quickly",
    ...overrides
  };
}

export function revisions(
  overrides: {
    current?: Partial<StoredRevision>;
    target?: Partial<StoredRevision>;
  } = {}
): StoredRevision[] {
  return [
    revision("revision-target", 1, "Reviews a refund", overrides.target),
    revision("revision-current", 2, "Reviews a refund quickly", overrides.current)
  ];
}

export function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-20T01:00:00.000Z",
    held_by_session_id: "session-lock",
    held_by_user_id: "user-2",
    holder: "user-2",
    id: "lock-1",
    mode: "HARD",
    reason: "Stabilize wording",
    usecase_id: "usecase-1",
    ...overrides
  };
}

export function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    id: "session-1",
    status: "ACTIVE",
    usecase_id: "usecase-1",
    user_id: "user-1",
    ...overrides
  };
}

export function defaultProject(branchId: string): StoredProject {
  return {
    default_branch_id: branchId,
    id: "project-1",
    key: "REV",
    name: "Revert",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

export function defaultBranch(): StoredSpecBranch {
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

function revision(
  id: string,
  versionNumber: number,
  title: string,
  overrides: Partial<StoredRevision> = {}
): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    snapshot: usecase({ current_revision_id: id, title }),
    version_number: versionNumber,
    ...overrides
  };
}
