import { describe, expect, test } from "vitest";
import { listSessionSnapshot } from "../../../src/application/session-list.js";
import type {
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

describe("session list application", () => {
  test("lists active workspace sessions with derived rows and zombie guidance", async () => {
    const result = await listSessionSnapshot(
      depsFor({
        branches: [branch()],
        locks: [lock()],
        sessions: [
          session({
            id: "session-newer",
            last_activity_at: "2026-05-20T00:20:00.000Z",
            started_at: "2026-05-20T00:10:00.000Z"
          }),
          session({
            id: "session-older",
            branch_id: null,
            last_activity_at: "2026-05-20T00:59:30.000Z",
            pinned_revisions: { "usecase-2": "revision-2" },
            started_at: "2026-05-20T00:05:00.000Z"
          }),
          session({ id: "session-completed", status: "COMPLETED" })
        ],
        usecases: [usecase(), usecase({ id: "usecase-2", key: "PAY-002" })]
      }),
      {
        projectId: undefined,
        status: "ACTIVE",
        targetUserId: undefined,
        userId: "user-1",
        workspaceId: "workspace-1"
      }
    );

    expect(result.status).toBe("LISTED");
    if (result.status !== "LISTED") {
      throw new Error("expected sessions to be listed");
    }
    expect(result.snapshot).toEqual({
      sessions: [
        {
          agent_identifier: "codex-cli",
          agent_type: "CODEX",
          branch_name: "agent/session-list",
          conflict_markers: [],
          id: "session-newer",
          idle_seconds: 2400,
          intent: "Monitor active checkout work",
          lock_count: 1,
          markers: ["ZOMBIE"],
          pinned_keys: ["PAY-001"],
          project_id: "project-1",
          started_at: "2026-05-20T00:10:00.000Z",
          status: "ACTIVE",
          user_id: "user-1"
        },
        {
          agent_identifier: "codex-cli",
          agent_type: "CODEX",
          branch_name: null,
          conflict_markers: [],
          id: "session-older",
          idle_seconds: 30,
          intent: "Monitor active checkout work",
          lock_count: 0,
          markers: [],
          pinned_keys: ["PAY-002"],
          project_id: "project-1",
          started_at: "2026-05-20T00:05:00.000Z",
          status: "ACTIVE",
          user_id: "user-1"
        }
      ],
      suggested_next_actions: [
        {
          command: "vspec session abandon session-newer",
          reason: "Review and explicitly abandon the stale active session."
        }
      ],
      summary: { total_conflicts: 0 },
      total: 2
    });
  });

  test("filters by project and user and reports pin conflicts", async () => {
    const result = await listSessionSnapshot(
      depsFor({
        sessions: [
          session({ id: "session-a", user_id: "user-2" }),
          session({ id: "session-b", user_id: "user-2" }),
          session({ id: "session-other-project", project_id: "project-2", user_id: "user-2" })
        ]
      }),
      {
        projectId: "project-1",
        status: "ACTIVE",
        targetUserId: "user-2",
        userId: "user-1",
        workspaceId: "workspace-1"
      }
    );

    expect(result.status).toBe("LISTED");
    if (result.status !== "LISTED") {
      throw new Error("expected sessions to be listed");
    }
    expect(result.snapshot.total).toBe(2);
    expect(result.snapshot.sessions.map((row) => row.id)).toEqual(["session-a", "session-b"]);
    expect(result.snapshot.sessions[0]?.conflict_markers).toEqual(["PINNED_BY:session-b"]);
    expect(result.snapshot.sessions[1]?.conflict_markers).toEqual(["PINNED_BY:session-a"]);
    expect(result.snapshot.summary).toEqual({ total_conflicts: 2 });
  });

  test("returns empty guidance and rejects non-members without reading sessions", async () => {
    const readSessions: string[] = [];

    await expect(
      listSessionSnapshot(depsFor({ sessions: [] }), {
        projectId: undefined,
        status: "ACTIVE",
        targetUserId: undefined,
        userId: "user-1",
        workspaceId: "workspace-1"
      })
    ).resolves.toEqual({
      snapshot: {
        sessions: [],
        suggested_next_actions: [
          {
            command: "vspec session start --intent \"...\"",
            reason: "Start a session when work begins."
          }
        ],
        summary: { total_conflicts: 0 },
        total: 0
      },
      status: "LISTED"
    });

    await expect(
      listSessionSnapshot(depsFor({ membership: null, readSessions }), {
        projectId: undefined,
        status: "ACTIVE",
        targetUserId: undefined,
        userId: "outsider",
        workspaceId: "workspace-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
    expect(readSessions).toEqual([]);
  });
});

function depsFor(
  options: {
    branches?: StoredSpecBranch[];
    locks?: StoredLock[];
    membership?: StoredMembership | null;
    projects?: StoredProject[];
    readSessions?: string[];
    sessions?: StoredWorkSession[];
    usecases?: StoredUseCase[];
  } = {}
) {
  return {
    branchStore: branchStore(options.branches ?? []),
    lockStore: lockStore(options.locks ?? []),
    membershipStore: membershipStore(
      "membership" in options ? options.membership ?? null : membership()
    ),
    now: () => new Date("2026-05-20T01:00:00.000Z"),
    projectStore: projectStore(options.projects ?? [project(), project({ id: "project-2" })]),
    useCaseStore: useCaseStore(options.usecases ?? [usecase()]),
    workSessionStore: workSessionStore(options.sessions ?? [], options.readSessions ?? [])
  };
}

function branchStore(branches: StoredSpecBranch[]): BranchStore {
  return {
    findBranchById: (branchId) => Promise.resolve(branches.find((item) => item.id === branchId)),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve(branches),
    saveBranch: () => Promise.resolve(),
    updateBranch: () => Promise.resolve()
  };
}

function lockStore(locks: StoredLock[]): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(undefined),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: (sessionId) =>
      Promise.resolve(locks.filter((item) => item.held_by_session_id === sessionId)),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(value: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () => Promise.resolve(value ?? undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(projects: StoredProject[]): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: (workspaceId) =>
      Promise.resolve(projects.filter((item) => item.workspace_id === workspaceId)),
    saveProject: () => Promise.resolve()
  };
}

function useCaseStore(usecases: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: (projectId) =>
      Promise.resolve(usecases.filter((item) => item.project_id === projectId)),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(
  sessions: StoredWorkSession[],
  readSessions: string[]
): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => {
      readSessions.push("list");
      return Promise.resolve(sessions);
    },
    listWorkSessionsForUseCase: () => Promise.resolve([]),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
  };
}

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    agent_identifier: "codex-cli",
    agent_type: "CODEX",
    branch_id: "branch-1",
    id: "session-1",
    intent: "Monitor active checkout work",
    last_activity_at: "2026-05-20T00:59:00.000Z",
    pinned_revisions: { "usecase-1": "revision-1" },
    project_id: "project-1",
    started_at: "2026-05-20T00:00:00.000Z",
    status: "ACTIVE",
    user_id: "user-1",
    ...overrides
  };
}

function branch(): StoredSpecBranch {
  return {
    base_branch_id: null,
    id: "branch-1",
    name: "agent/session-list",
    owner_id: "user-1",
    owner_type: "AGENT",
    project_id: "project-1"
  };
}

function lock(): StoredLock {
  return {
    expires_at: "2026-05-20T02:00:00.000Z",
    held_by_session_id: "session-newer",
    held_by_user_id: "user-1",
    holder: "session-newer",
    id: "lock-1",
    mode: "SEMANTIC",
    reason: "Session owns semantic edits.",
    usecase_id: "usecase-1"
  };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Reviews payment history",
    ...overrides
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
