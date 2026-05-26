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

describe("lock application edge cases", () => {
  test("rejects missing or unauthorized lock renewals", async () => {
    const activeLock = lock();

    await expect(renewLock(depsFor(), renewInput())).resolves.toEqual({
      status: "LOCK_NOT_FOUND"
    });
    await expect(
      renewLock(depsFor({ existingLock: activeLock, membership: null }), renewInput())
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });

  test("reports active foreign locks for hard lock requests", async () => {
    const existing = lock({ held_by_session_id: "session-other", mode: "SOFT" });

    await expect(
      acquireLock(depsFor({ existingLock: existing }), lockInput({ lockType: "HARD" }))
    ).resolves.toEqual({
      lock: existing,
      status: "COMPETING_LOCK",
      usecase: usecase()
    });
  });

  test("replaces expired locks without stored ids", async () => {
    const deletedLockIds: string[] = [];

    const result = await acquireLock(
      depsFor({
        deletedLockIds,
        existingLock: lock({ expires_at: "2026-05-19T23:59:00.000Z", id: undefined })
      }),
      lockInput()
    );

    expect(result.status).toBe("CREATED");
    expect(deletedLockIds).toEqual(["usecase-1"]);
  });

  test("replaces non-blocking active locks", async () => {
    const deletedLockIds: string[] = [];

    const result = await acquireLock(
      depsFor({
        deletedLockIds,
        existingLock: lock({ held_by_session_id: "session-other", mode: "SOFT" })
      }),
      lockInput({ lockType: "SEMANTIC" })
    );

    expect(result.status).toBe("CREATED");
    expect(deletedLockIds).toEqual(["lock-1"]);
  });

  test("soft locks coexist with active locks and warn about holders", async () => {
    const deletedLockIds: string[] = [];

    const result = await acquireLock(
      depsFor({
        deletedLockIds,
        existingLock: lock({
          held_by_session_id: "session-other",
          holder: "session-other",
          mode: "SEMANTIC"
        })
      }),
      lockInput({ lockType: "SOFT" })
    );

    expect(result).toMatchObject({
      status: "CREATED",
      warnings: [
        {
          holders: ["session-other"],
          type: "SOFT_LOCK_COEXISTS"
        }
      ]
    });
    expect(deletedLockIds).toEqual([]);
  });

  test("soft reacquire by the same user holder updates without duplicating", async () => {
    const deletedLockIds: string[] = [];
    const savedLocks: StoredLock[] = [];
    const updatedLocks: StoredLock[] = [];

    const result = await acquireLock(
      depsFor({
        deletedLockIds,
        existingLock: lock({
          held_by_session_id: null,
          held_by_user_id: "user-1",
          holder: "user-1",
          mode: "SOFT"
        }),
        savedLocks,
        updatedLocks
      }),
      lockInput({ lockType: "SOFT", sessionId: null })
    );

    expect(result).toMatchObject({
      lock: { id: "lock-1", reason: "Agent is rewriting the success scenario." },
      status: "CREATED"
    });
    expect(deletedLockIds).toEqual([]);
    expect(savedLocks).toEqual([]);
    expect(updatedLocks).toHaveLength(1);
  });
});

function depsFor(
  options: {
    deletedLockIds?: string[];
    existingLock?: StoredLock;
    membership?: StoredMembership | null;
    savedLocks?: StoredLock[];
    updatedLocks?: StoredLock[];
  } = {}
) {
  return {
    idFactory: () => "id-1",
    lockStore: lockStore(options),
    membershipStore: membershipStore(
      options.membership === undefined ? membership() : options.membership
    ),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    useCaseStore: useCaseStore()
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
    listLocksForUseCase: () =>
      Promise.resolve(options.existingLock === undefined ? [] : [options.existingLock]),
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

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve({ projectId: "project-1", usecase: usecase() }),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function lockInput(
  overrides: { lockType?: StoredLock["mode"]; sessionId?: null | string } = {}
) {
  return {
    lockType: overrides.lockType ?? "SEMANTIC",
    reason: "Agent is rewriting the success scenario.",
    sessionId: overrides.sessionId === undefined ? "session-1" : overrides.sessionId,
    targetId: "usecase-1",
    targetType: "USECASE" as const,
    ttlMinutes: 30,
    userId: "user-1"
  };
}

function renewInput() {
  return {
    lockId: "lock-1",
    sessionId: "session-1",
    ttlMinutes: 30,
    userId: "user-1"
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-20T00:30:00.000Z",
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "session-1",
    id: "lock-1",
    mode: "SEMANTIC",
    reason: "Agent is rewriting the success scenario.",
    usecase_id: "usecase-1",
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
