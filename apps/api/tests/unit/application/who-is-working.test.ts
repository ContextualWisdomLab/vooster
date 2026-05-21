import { describe, expect, test } from "vitest";
import { whoIsWorking } from "../../../src/application/who-is-working.js";
import type { StoredMergeRequest } from "../../../src/domain/entities/index.js";
import type {
  StoredLock,
  StoredMembership,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { MergeRequestStore } from "../../../src/ports/merge-request-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

describe("who is working application", () => {
  test("returns active sessions locks and merge requests with coordination guidance", async () => {
    const result = await whoIsWorking(
      depsFor({
        branches: [branch("branch-source", { "usecase-1": "revision-2" })],
        locks: [lock()],
        mergeRequests: [mergeRequest()],
        sessions: [session()]
      }),
      { usecaseId: "usecase-1", userId: "user-1" }
    );

    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") {
      throw new Error("expected who result");
    }
    expect(result.usecase).toEqual({ id: "usecase-1", key: "CHK-001" });
    expect(result.sessions).toEqual([
      {
        agent_type: "CODEX",
        id: "session-1",
        intent: "Coordinate on refund review",
        markers: [],
        started_at: "2026-05-20T00:00:00.000Z",
        user_id: "user-1"
      }
    ]);
    expect(result.locks).toEqual([
      {
        expires_at: "2026-05-20T01:00:00.000Z",
        held_by_session_id: "session-1",
        held_by_user_id: "user-1",
        id: "lock-1",
        lock_type: "SEMANTIC"
      }
    ]);
    expect(result.mergeRequests).toEqual([
      {
        conflict_count: 1,
        id: "merge-1",
        source_branch_id: "branch-source",
        status: "OPEN"
      }
    ]);
    expect(result.suggestedNextActions).toContainEqual({
      command: "vspec lock list",
      reason: "Review active locks before editing."
    });
    expect(result.suggestedNextActions).toContainEqual({
      command: "vspec merge show merge-1",
      reason: "Review the open merge request touching this use case."
    });
  });

  test("reports missing use cases and forbidden callers without leaking work", async () => {
    await expect(
      whoIsWorking(depsFor({ usecase: null }), {
        usecaseId: "CHK-999",
        userId: "user-1"
      })
    ).resolves.toEqual({ missingUsecaseId: "CHK-999", status: "USECASE_NOT_FOUND" });

    await expect(
      whoIsWorking(depsFor({ membership: null }), {
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });

  test("suggests starting a session when no active work touches the use case", async () => {
    const result = await whoIsWorking(depsFor(), {
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") {
      throw new Error("expected empty who result");
    }
    expect(result.sessions).toEqual([]);
    expect(result.locks).toEqual([]);
    expect(result.mergeRequests).toEqual([]);
    expect(result.suggestedNextActions).toEqual([
      {
        command: "vspec session start --intent \"...\" --pin CHK-001",
        reason: "Start a session on this use case."
      }
    ]);
  });

  test("marks stale sessions as zombie and suggests abandoning them", async () => {
    const result = await whoIsWorking(
      depsFor({
        sessions: [
          session({
            id: "session-stale",
            last_activity_at: "2026-05-20T00:20:00.000Z",
            started_at: "2026-05-20T00:00:00.000Z"
          })
        ]
      }),
      { usecaseId: "usecase-1", userId: "user-1" }
    );

    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") {
      throw new Error("expected zombie who result");
    }
    expect(result.sessions[0]?.markers).toEqual(["ZOMBIE"]);
    expect(result.suggestedNextActions).toContainEqual({
      command: "vspec session abandon session-stale",
      reason: "Review and explicitly abandon the stale active session."
    });
  });

  test("reports archived use cases and suggests restore when active work exists", async () => {
    const result = await whoIsWorking(
      depsFor({
        locks: [lock()],
        usecase: usecase({ archived_at: "2026-05-20T00:00:00.000Z" })
      }),
      { usecaseId: "usecase-1", userId: "user-1" }
    );

    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") {
      throw new Error("expected archived who result");
    }
    expect(result.archived).toBe(true);
    expect(result.suggestedNextActions).toContainEqual({
      command: "vspec usecase restore CHK-001",
      reason: "Restore the archived use case before coordinating active work."
    });
  });
});

function depsFor(options: {
  branches?: StoredSpecBranch[];
  locks?: StoredLock[];
  membership?: StoredMembership | null;
  mergeRequests?: StoredMergeRequest[];
  sessions?: StoredWorkSession[];
  usecase?: StoredUseCase | null;
} = {}) {
  return {
    branchStore: branchStore(options.branches ?? []),
    lockStore: lockStore(options.locks ?? []),
    membershipStore: membershipStore(
      options.membership === undefined ? membership() : options.membership
    ),
    mergeRequestStore: mergeRequestStore(options.mergeRequests ?? []),
    now: () => new Date("2026-05-20T01:00:00.000Z"),
    useCaseStore: useCaseStore(options.usecase === undefined ? usecase() : options.usecase),
    workSessionStore: workSessionStore(options.sessions ?? [])
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
    listLocksForUseCase: () => Promise.resolve(locks),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(foundMembership: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(foundMembership ?? undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function mergeRequestStore(mergeRequests: StoredMergeRequest[]): MergeRequestStore {
  return {
    findMergeRequestById: () => Promise.resolve(undefined),
    listOpenMergeRequests: () => Promise.resolve(mergeRequests),
    listOpenMergeRequestsByTargetBranchId: () => Promise.resolve([]),
    saveMergeRequest: () => Promise.resolve(),
    updateMergeRequest: () => Promise.resolve()
  };
}

function useCaseStore(foundUseCase: StoredUseCase | null): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(
        foundUseCase === null
          ? undefined
          : { projectId: foundUseCase.project_id, usecase: foundUseCase }
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve(sessions),
    listWorkSessionsForUseCase: () => Promise.resolve(sessions),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
  };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Reviews a refund",
    ...overrides
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    agent_type: "CODEX",
    id: "session-1",
    intent: "Coordinate on refund review",
    last_activity_at: "2026-05-20T00:59:00.000Z",
    pinned_revisions: { "usecase-1": "revision-1" },
    started_at: "2026-05-20T00:00:00.000Z",
    status: "ACTIVE",
    user_id: "user-1",
    ...overrides
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-20T01:00:00.000Z",
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "user-1",
    id: "lock-1",
    lock_type: "SEMANTIC",
    mode: "SEMANTIC",
    reason: "Session is editing semantics.",
    target_type: "USECASE",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function branch(branchId: string, headRevisionIds: Record<string, string>): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: headRevisionIds,
    id: branchId,
    name: "feature/who-open-merge",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
  };
}

function mergeRequest(overrides: Partial<StoredMergeRequest> = {}): StoredMergeRequest {
  return {
    conflicts: [{ type: "TEXT" }],
    id: "merge-1",
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: {}
    },
    source_branch_id: "branch-source",
    status: "OPEN",
    strategy: "FAST_FORWARD",
    target_branch_id: "branch-main",
    ...overrides
  };
}
