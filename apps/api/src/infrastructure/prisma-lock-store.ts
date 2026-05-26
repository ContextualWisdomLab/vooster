import type { PrismaClient } from "@prisma/client";

import type { StoredLock } from "../domain/entities/index.js";
import type { LockStore } from "../ports/lock-store.js";
import { ensureLockSession } from "./prisma-lock-session.js";
import { lockData, lockUpdate, storedLock } from "./prisma-signup-mappers.js";

export function createPrismaLockStore(prisma: PrismaClient): LockStore {
  return new PrismaLockStore(prisma);
}

class PrismaLockStore implements LockStore {
  constructor(private readonly prisma: PrismaClient) {}

  async deleteLock(lockId: string): Promise<void> {
    await this.prisma.lock.deleteMany({
      where: { id: lockId }
    });
  }

  async deleteLockForUseCase(usecaseId: string): Promise<void> {
    await this.prisma.lock.deleteMany({
      where: { target_id: usecaseId, target_type: "USECASE" }
    });
  }

  async findLockById(lockId: string): Promise<StoredLock | undefined> {
    const lock = await this.prisma.lock.findUnique({
      where: { id: lockId }
    });

    return lock === null ? undefined : storedLock(lock);
  }

  async findLockForUseCase(usecaseId: string): Promise<StoredLock | undefined> {
    const lock = await this.prisma.lock.findFirst({
      orderBy: [{ lock_type: "asc" }, { acquired_at: "desc" }],
      where: { target_id: usecaseId, target_type: "USECASE" }
    });

    return lock === null ? undefined : storedLock(lock);
  }

  async listLocksForUseCase(usecaseId: string): Promise<StoredLock[]> {
    const locks = await this.prisma.lock.findMany({
      orderBy: { acquired_at: "asc" },
      where: { target_id: usecaseId, target_type: "USECASE" }
    });

    return locks.map(storedLock);
  }

  async listLocksHeldBySession(sessionId: string): Promise<StoredLock[]> {
    const locks = await this.prisma.lock.findMany({
      orderBy: { acquired_at: "asc" },
      where: { held_by_session_id: sessionId }
    });

    return locks.map(storedLock);
  }

  async saveLock(lock: StoredLock): Promise<void> {
    await ensureLockSession(this.prisma, lock);
    await this.prisma.lock.create({ data: lockData(lock) });
  }

  async updateLock(lock: StoredLock): Promise<void> {
    await ensureLockSession(this.prisma, lock);
    await this.prisma.lock.update({
      data: lockUpdate(lock),
      where: { id: lock.id ?? lock.usecase_id }
    });
  }
}
