import type { StoredLock } from "../http/signup-types.js";
import type { LockStore } from "../ports/lock-store.js";

export function createMemoryLockStore(): LockStore {
  const locksById = new Map<string, StoredLock>();

  return {
    deleteLock(lockId) {
      const lock = locksById.get(lockId);
      if (lock !== undefined) {
        locksById.delete(lockKey(lock));
        return Promise.resolve();
      }

      for (const [key, candidate] of locksById) {
        if (candidate.usecase_id === lockId) {
          locksById.delete(key);
        }
      }
      return Promise.resolve();
    },

    deleteLockForUseCase(usecaseId) {
      for (const [key, lock] of locksById) {
        if (lock.usecase_id === usecaseId) {
          locksById.delete(key);
        }
      }
      return Promise.resolve();
    },

    findLockById(lockId) {
      return Promise.resolve(
        locksById.get(lockId) ??
          [...locksById.values()].find((lock) => lock.id === lockId)
      );
    },

    findLockForUseCase(usecaseId) {
      return Promise.resolve(
        [...locksById.values()].find((lock) => lock.usecase_id === usecaseId)
      );
    },

    listLocksForUseCase(usecaseId) {
      return Promise.resolve(
        [...locksById.values()].filter((lock) => lock.usecase_id === usecaseId)
      );
    },

    listLocksHeldBySession(sessionId) {
      return Promise.resolve(
        [...locksById.values()].filter((lock) => lock.holder === sessionId)
      );
    },

    saveLock(lock) {
      locksById.set(lockKey(lock), lock);
      return Promise.resolve();
    },

    updateLock(lock) {
      locksById.set(lockKey(lock), lock);
      return Promise.resolve();
    }
  };
}

function lockKey(lock: StoredLock): string {
  return lock.id ?? lock.usecase_id;
}
