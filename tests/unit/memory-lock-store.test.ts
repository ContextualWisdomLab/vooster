import { describe, expect, test } from "vitest";
import { createMemoryLockStore } from "../../src/infrastructure/memory-lock-store.js";
import type { StoredLock } from "../../src/http/signup-types.js";

describe("memory lock store", () => {
  test("stores, finds, updates, and deletes locks by id", async () => {
    const store = createMemoryLockStore();
    const lock = storedLock({ id: "lock-1", usecase_id: "UC-1" });

    await store.saveLock(lock);
    expect(await store.findLockById("lock-1")).toEqual(lock);
    expect(await store.findLockForUseCase("UC-1")).toEqual(lock);
    expect(await store.listLocksForUseCase("UC-1")).toEqual([lock]);
    expect(await store.listLocksHeldBySession("session-1")).toEqual([lock]);

    await store.updateLock({ ...lock, reason: "Renewed" });
    expect(await store.findLockById("lock-1")).toMatchObject({ reason: "Renewed" });

    await store.deleteLock("lock-1");
    expect(await store.findLockById("lock-1")).toBeUndefined();
  });

  test("uses the use case id when a legacy test lock has no id", async () => {
    const store = createMemoryLockStore();
    const lock = storedLock({ id: undefined, usecase_id: "UC-2" });

    await store.saveLock(lock);
    expect(await store.findLockById("UC-2")).toEqual(lock);

    await store.deleteLock("UC-2");
    expect(await store.findLockForUseCase("UC-2")).toBeUndefined();
  });

  test("deletes an id-backed lock when called with its use case id", async () => {
    const store = createMemoryLockStore();
    const lock = storedLock({ id: "lock-5", usecase_id: "UC-5" });

    await store.saveLock(lock);
    await store.deleteLock("UC-5");

    expect(await store.findLockById("lock-5")).toBeUndefined();
  });

  test("deletes every lock for a use case", async () => {
    const store = createMemoryLockStore();
    const first = storedLock({ id: "semantic-lock", usecase_id: "UC-3" });
    const second = storedLock({ id: "hard-lock", mode: "HARD", usecase_id: "UC-3" });
    const unrelated = storedLock({ id: "other-lock", usecase_id: "UC-4" });

    await store.saveLock(first);
    await store.saveLock(second);
    await store.saveLock(unrelated);

    await store.deleteLockForUseCase("UC-3");

    expect(await store.listLocksForUseCase("UC-3")).toEqual([]);
    expect(await store.listLocksForUseCase("UC-4")).toEqual([unrelated]);
  });
});

function storedLock(
  overrides: Partial<StoredLock> & { usecase_id: string }
): StoredLock {
  return {
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "session-1",
    id: "lock-1",
    lock_type: "SEMANTIC",
    mode: "SEMANTIC",
    reason: "Editing use case",
    target_id: overrides.usecase_id,
    target_type: "USECASE",
    ...overrides
  };
}
