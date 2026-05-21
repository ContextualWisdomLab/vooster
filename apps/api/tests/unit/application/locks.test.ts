import { describe, expect, test } from "vitest";
import { acquireLock, renewLock } from "../../../src/application/locks.js";
import type {
  StoredLock,
  StoredMembership,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("locks application", () => {
  test("acquires a finite auto-release use case lock", async () => {
    const savedLocks: StoredLock[] = [];

    const result = await acquireLock(
      depsFor({ savedLocks }),
      {
        lockType: "SEMANTIC",
        reason: "Agent is rewriting the success scenario.",
        sessionId: "session-main-lock",
        targetId: "usecase-1",
        targetType: "USECASE",
        ttlMinutes: 15,
        userId: "user-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected lock to be created");
    }
    expect(result.lock).toEqual({
      acquired_at: "2026-05-20T00:00:00.000Z",
      auto_release: true,
      expires_at: "2026-05-20T00:15:00.000Z",
      held_by_session_id: "session-main-lock",
      held_by_user_id: "user-1",
      holder: "session-main-lock",
      id: "id-1",
      lock_type: "SEMANTIC",
      mode: "SEMANTIC",
      reason: "Agent is rewriting the success scenario.",
      target_id: "usecase-1",
      target_type: "USECASE",
      usecase_id: "usecase-1"
    });
    expect(savedLocks).toEqual([result.lock]);
  });

  test("rejects missing or unauthorized lock targets without writing", async () => {
    const savedLocks: StoredLock[] = [];

    await expect(
      acquireLock(depsFor({ savedLocks, usecase: null }), lockInput())
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });
    await expect(
      acquireLock(depsFor({ membership: null, savedLocks }), lockInput())
    ).resolves.toEqual({ status: "FORBIDDEN" });

    expect(savedLocks).toEqual([]);
  });

  test("rejects competing semantic locks and reports the blocker", async () => {
    const existing = lock({ held_by_session_id: "session-a" });

    const result = await acquireLock(
      depsFor({ existingLock: existing }),
      lockInput({ sessionId: "session-b" })
    );

    expect(result).toEqual({
      lock: existing,
      status: "COMPETING_LOCK",
      usecase: usecase()
    });
  });

  test("replaces expired locks during fresh acquisition", async () => {
    const deletedLockIds: string[] = [];
    const savedLocks: StoredLock[] = [];

    const result = await acquireLock(
      depsFor({
        deletedLockIds,
        existingLock: lock({ expires_at: "2026-05-19T23:59:00.000Z" }),
        savedLocks
      }),
      lockInput({ lockType: "HARD", sessionId: "session-fresh" })
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected fresh lock to be created");
    }
    expect(deletedLockIds).toEqual(["lock-1"]);
    expect(savedLocks[0]).toMatchObject({
      held_by_session_id: "session-fresh",
      lock_type: "HARD"
    });
  });

  test("renews an owned active lock", async () => {
    const updatedLocks: StoredLock[] = [];

    const result = await renewLock(
      depsFor({ existingLock: lock(), updatedLocks }),
      {
        lockId: "lock-1",
        sessionId: "session-1",
        ttlMinutes: 45,
        userId: "user-1"
      }
    );

    expect(result.status).toBe("RENEWED");
    if (result.status !== "RENEWED") {
      throw new Error("expected lock to be renewed");
    }
    expect(result.lock.expires_at).toBe("2026-05-20T00:45:00.000Z");
    expect(updatedLocks).toEqual([result.lock]);
  });

  test("rejects foreign or expired renewal without updating", async () => {
    const updatedLocks: StoredLock[] = [];
    const activeLock = lock();
    const expiredLock = lock({ expires_at: "2026-05-19T23:59:00.000Z" });

    await expect(
      renewLock(depsFor({ existingLock: activeLock, updatedLocks }), {
        lockId: "lock-1",
        sessionId: "session-other",
        ttlMinutes: 30,
        userId: "user-1"
      })
    ).resolves.toEqual({
      lock: activeLock,
      status: "FOREIGN_LOCK",
      usecase: usecase()
    });

    await expect(
      renewLock(depsFor({ existingLock: expiredLock, updatedLocks }), {
        lockId: "lock-1",
        sessionId: "session-1",
        ttlMinutes: 30,
        userId: "user-1"
      })
    ).resolves.toEqual({
      lock: expiredLock,
      status: "EXPIRED_LOCK",
      usecase: usecase()
    });

    expect(updatedLocks).toEqual([]);
  });
});

function depsFor(options: {
  deletedLockIds?: string[];
  existingLock?: StoredLock;
  membership?: StoredMembership | null;
  savedLocks?: StoredLock[];
  updatedLocks?: StoredLock[];
  usecase?: StoredUseCase | null;
} = {}) {
  return {
    idFactory: () => "id-1",
    lockStore: lockStore(options),
    membershipStore: membershipStore(
      options.membership === undefined ? membership() : options.membership
    ),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    useCaseStore: useCaseStore(options.usecase === undefined ? usecase() : options.usecase)
  };
}

function lockStore(options: {
  deletedLockIds?: string[];
  existingLock?: StoredLock;
  savedLocks?: StoredLock[];
  updatedLocks?: StoredLock[];
}): LockStore {
  return {
    deleteLock: (lockId) => {
      options.deletedLockIds?.push(lockId);
      return Promise.resolve();
    },
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(options.existingLock),
    findLockForUseCase: () => Promise.resolve(options.existingLock),
    listLocksForUseCase: () => Promise.resolve(options.existingLock === undefined ? [] : [options.existingLock]),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: (newLock) => {
      options.savedLocks?.push(newLock);
      return Promise.resolve();
    },
    updateLock: (updatedLock) => {
      options.updatedLocks?.push(updatedLock);
      return Promise.resolve();
    }
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

function lockInput(overrides: {
  lockType?: "HARD" | "SEMANTIC" | "SOFT";
  sessionId?: null | string;
} = {}) {
  return {
    lockType: overrides.lockType ?? "SEMANTIC",
    reason: "Agent is rewriting the success scenario.",
    sessionId: overrides.sessionId ?? "session-1",
    targetId: "usecase-1",
    targetType: "USECASE" as const,
    ttlMinutes: 30,
    userId: "user-1"
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    acquired_at: "2026-05-20T00:00:00.000Z",
    auto_release: true,
    expires_at: "2026-05-20T00:30:00.000Z",
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "session-1",
    id: "lock-1",
    lock_type: "SEMANTIC",
    mode: "SEMANTIC",
    reason: "Agent is rewriting the success scenario.",
    target_id: "usecase-1",
    target_type: "USECASE",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "LCK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Reviews locked refund"
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
