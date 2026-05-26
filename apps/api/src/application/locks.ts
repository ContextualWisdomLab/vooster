import { randomUUID } from "node:crypto";
import type { StoredLock, StoredUseCase } from "../domain/entities/index.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type LockApplicationDeps = {
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  now?: () => Date;
  useCaseStore: UseCaseStore;
};

export type LockResult =
  | {
      lock: StoredLock;
      status: "CREATED" | "RELEASED" | "RENEWED";
      usecase: StoredUseCase;
      warnings?: LockWarning[];
    }
  | {
      lock: StoredLock;
      status: "COMPETING_LOCK" | "EXPIRED_LOCK" | "FOREIGN_LOCK";
      usecase: StoredUseCase;
    }
  | { status: "FORBIDDEN" | "LOCK_NOT_FOUND" | "USECASE_NOT_FOUND" };

export type LockWarning = {
  holders: string[];
  message: string;
  type: "SOFT_LOCK_COEXISTS";
};

export type AcquireLockInput = {
  lockType: StoredLock["mode"];
  reason: string;
  sessionId: null | string;
  targetId: string;
  targetType: "USECASE";
  ttlMinutes: number;
  userId: string | undefined;
};

export type RenewLockInput = {
  lockId: string;
  sessionId: null | string;
  ttlMinutes: number;
  userId: string | undefined;
};

export type ReleaseLockInput = {
  lockId: string;
  sessionId: null | string;
  userId: string | undefined;
};

export async function acquireLock(
  deps: LockApplicationDeps,
  input: AcquireLockInput
): Promise<LockResult> {
  const found = await authorizedUseCase(deps, input.targetId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }

  const existingLocks = await deps.lockStore.listLocksForUseCase(found.usecase.id);
  const blockedBy = existingLocks.find((lock) =>
    blockingLock(deps, lock, input.lockType, input.sessionId)
  );
  if (blockedBy !== undefined) {
    return { lock: blockedBy, status: "COMPETING_LOCK", usecase: found.usecase };
  }

  const warnings =
    input.lockType === "SOFT" ? softLockWarnings(deps, existingLocks, input) : [];
  if (input.lockType !== "SOFT") {
    for (const existing of existingLocks) {
      await deps.lockStore.deleteLock(existing.id ?? existing.usecase_id);
    }
  }

  const lock = useCaseLock(deps, input, found.usecase, found.userId);
  await deps.lockStore.saveLock(lock);
  return {
    lock,
    status: "CREATED",
    usecase: found.usecase,
    ...(warnings.length === 0 ? {} : { warnings })
  };
}

export async function renewLock(
  deps: LockApplicationDeps,
  input: RenewLockInput
): Promise<LockResult> {
  const lock = await deps.lockStore.findLockById(input.lockId);
  if (lock === undefined) {
    return { status: "LOCK_NOT_FOUND" };
  }
  const found = await authorizedUseCase(deps, lock.usecase_id, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  if (!ownsLock(lock, found.userId, input.sessionId)) {
    return { lock, status: "FOREIGN_LOCK", usecase: found.usecase };
  }
  if (Date.parse(lock.expires_at) <= now(deps).getTime()) {
    return { lock, status: "EXPIRED_LOCK", usecase: found.usecase };
  }

  lock.expires_at = new Date(
    now(deps).getTime() + input.ttlMinutes * 60_000
  ).toISOString();
  await deps.lockStore.updateLock(lock);
  return { lock, status: "RENEWED", usecase: found.usecase };
}

export async function releaseLock(
  deps: LockApplicationDeps,
  input: ReleaseLockInput
): Promise<LockResult> {
  const lock = await deps.lockStore.findLockById(input.lockId);
  if (lock === undefined) {
    return { status: "LOCK_NOT_FOUND" };
  }
  const found = await authorizedUseCase(deps, lock.usecase_id, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  if (!ownsLock(lock, found.userId, input.sessionId)) {
    return { lock, status: "FOREIGN_LOCK", usecase: found.usecase };
  }
  if (Date.parse(lock.expires_at) <= now(deps).getTime()) {
    return { lock, status: "EXPIRED_LOCK", usecase: found.usecase };
  }

  await deps.lockStore.deleteLock(input.lockId);
  return { lock, status: "RELEASED", usecase: found.usecase };
}

async function authorizedUseCase(
  deps: LockApplicationDeps,
  usecaseId: string,
  userId: string | undefined
): Promise<
  | { status: "AUTHORIZED"; usecase: StoredUseCase; userId: string }
  | { status: "FORBIDDEN" | "USECASE_NOT_FOUND" }
> {
  const found = await deps.useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined || found.usecase.archived_at !== null) {
    return { status: "USECASE_NOT_FOUND" };
  }
  return userId !== undefined &&
    (await deps.membershipStore.membershipForProject(found.projectId, userId)) !==
      undefined
    ? { status: "AUTHORIZED", usecase: found.usecase, userId }
    : { status: "FORBIDDEN" };
}

function blockingLock(
  deps: LockApplicationDeps,
  lock: StoredLock | undefined,
  requestedType: StoredLock["mode"],
  sessionId: null | string
): StoredLock | undefined {
  if (lock === undefined || lock.held_by_session_id === sessionId) {
    return undefined;
  }
  if (Date.parse(lock.expires_at) <= now(deps).getTime()) {
    return undefined;
  }
  if (requestedType === "HARD") {
    return lock;
  }
  return requestedType === "SEMANTIC" &&
    (lock.mode === "SEMANTIC" || lock.mode === "HARD")
    ? lock
    : undefined;
}

function ownsLock(lock: StoredLock, userId: string, sessionId: null | string) {
  return lock.held_by_session_id === null
    ? lock.held_by_user_id === userId
    : lock.held_by_session_id === sessionId;
}

function softLockWarnings(
  deps: LockApplicationDeps,
  locks: StoredLock[],
  input: AcquireLockInput
): LockWarning[] {
  const holders = locks
    .filter((lock) => Date.parse(lock.expires_at) > now(deps).getTime())
    .filter((lock) => lock.held_by_session_id !== input.sessionId)
    .map((lock) => lock.holder);

  return holders.length === 0
    ? []
    : [
        {
          holders,
          message: `SOFT lock coexists with ${holders.join(", ")}`,
          type: "SOFT_LOCK_COEXISTS"
        }
      ];
}

function useCaseLock(
  deps: LockApplicationDeps,
  input: AcquireLockInput,
  usecase: StoredUseCase,
  userId: string
): StoredLock {
  const acquiredAt = now(deps);
  return {
    acquired_at: acquiredAt.toISOString(),
    auto_release: true,
    expires_at: new Date(
      acquiredAt.getTime() + input.ttlMinutes * 60_000
    ).toISOString(),
    held_by_session_id: input.sessionId,
    held_by_user_id: userId,
    holder: input.sessionId ?? userId,
    id: (deps.idFactory ?? randomUUID)(),
    lock_type: input.lockType,
    mode: input.lockType,
    reason: input.reason,
    target_id: usecase.id,
    target_type: input.targetType,
    usecase_id: usecase.id
  };
}

function now(deps: LockApplicationDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
