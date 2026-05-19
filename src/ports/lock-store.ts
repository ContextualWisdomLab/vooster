import type { StoredLock } from "../http/signup-types.js";

export type LockStore = {
  deleteLock: (lockId: string) => Promise<void>;
  deleteLockForUseCase: (usecaseId: string) => Promise<void>;
  findLockById: (lockId: string) => Promise<StoredLock | undefined>;
  findLockForUseCase: (usecaseId: string) => Promise<StoredLock | undefined>;
  listLocksForUseCase: (usecaseId: string) => Promise<StoredLock[]>;
  listLocksHeldBySession: (sessionId: string) => Promise<StoredLock[]>;
  saveLock: (lock: StoredLock) => Promise<void>;
  updateLock: (lock: StoredLock) => Promise<void>;
};
