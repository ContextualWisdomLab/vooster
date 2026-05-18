import { problem } from "./signup-support.js";
import type { StoredLock, StoredUseCase } from "./signup-types.js";

export function blockingLock(
  lock: StoredLock | undefined,
  requestedType: StoredLock["mode"],
  sessionId: null | string
): StoredLock | undefined {
  if (lock === undefined || lock.held_by_session_id === sessionId) {
    return undefined;
  }
  if (requestedType === "HARD") {
    return lock;
  }
  return requestedType === "SEMANTIC" && (lock.mode === "SEMANTIC" || lock.mode === "HARD")
    ? lock
    : undefined;
}

export function ownsLock(lock: StoredLock, userId: string, sessionId: null | string) {
  return lock.held_by_session_id === null
    ? lock.held_by_user_id === userId
    : lock.held_by_session_id === sessionId;
}

export function competingLockProblem(lock: StoredLock, usecase: StoredUseCase) {
  return problem(
    409,
    "Competing lock exists",
    {
      expires_at: lock.expires_at,
      held_by_user_id: lock.held_by_user_id,
      holding_session: lock.held_by_session_id ?? lock.holder
    },
    [
      {
        command: `vspec who ${usecase.key}`,
        reason: "Inspect the session holding the lock."
      }
    ]
  );
}

export function expiredLockProblem(lock: StoredLock, usecase: StoredUseCase) {
  return problem(
    409,
    "Expired lock cannot be renewed",
    { expires_at: lock.expires_at, lock_id: lock.id },
    [
      {
        command: `vspec lock ${usecase.key} --type ${lock.mode.toLowerCase()}`,
        reason: "Reacquire the lock from scratch."
      }
    ]
  );
}

export function foreignLockProblem(lock: StoredLock, usecase: StoredUseCase) {
  return problem(
    403,
    "Caller does not own this lock",
    {
      expires_at: lock.expires_at,
      holding_session: lock.held_by_session_id ?? lock.holder,
      lock_id: lock.id
    },
    [
      {
        command: `vspec who ${usecase.key}`,
        reason: "Identify the lock owner."
      }
    ]
  );
}
