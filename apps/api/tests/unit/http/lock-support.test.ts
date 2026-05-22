import { afterEach, describe, expect, test, vi } from "vitest";
import type { StoredLock, StoredUseCase } from "../../../src/domain/entities/index.js";
import {
  blockingLock,
  competingLockProblem,
  expiredLockProblem,
  foreignLockProblem,
  ownsLock
} from "../../../src/http/lock-support.js";

describe("lock support", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("ignores absent, owned, and expired locks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00Z"));

    expect(blockingLock(undefined, "HARD", "session-1")).toBeUndefined();
    expect(
      blockingLock(lock({ held_by_session_id: "session-1" }), "HARD", "session-1")
    ).toBeUndefined();
    expect(
      blockingLock(
        lock({
          expires_at: "2026-05-23T09:59:59Z",
          held_by_session_id: "session-2"
        }),
        "HARD",
        "session-1"
      )
    ).toBeUndefined();
  });

  test("blocks lock requests according to requested strength", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00Z"));

    const semantic = lock({ held_by_session_id: "session-2", mode: "SEMANTIC" });
    const soft = lock({ held_by_session_id: "session-2", mode: "SOFT" });

    expect(blockingLock(semantic, "HARD", "session-1")).toBe(semantic);
    expect(blockingLock(semantic, "SEMANTIC", "session-1")).toBe(semantic);
    expect(blockingLock(soft, "SEMANTIC", "session-1")).toBeUndefined();
    expect(blockingLock(semantic, "SOFT", "session-1")).toBeUndefined();
  });

  test("recognizes session and user lock ownership", () => {
    expect(
      ownsLock(lock({ held_by_session_id: "session-1" }), "user-2", "session-1")
    ).toBe(true);
    expect(
      ownsLock(
        lock({ held_by_session_id: null, held_by_user_id: "user-1" }),
        "user-1",
        null
      )
    ).toBe(true);
    expect(
      ownsLock(lock({ held_by_session_id: "session-1" }), "user-1", "session-2")
    ).toBe(false);
  });

  test("serializes lock problems with recovery commands", () => {
    const usecase = storedUseCase();
    const activeLock = lock({
      expires_at: "2026-05-23T11:00:00Z",
      held_by_session_id: "session-2",
      held_by_user_id: "user-2",
      id: "lock-1",
      mode: "HARD"
    });

    expect(competingLockProblem(activeLock, usecase)).toMatchObject({
      expires_at: "2026-05-23T11:00:00Z",
      held_by_user_id: "user-2",
      holding_session: "session-2",
      status: 409,
      title: "Competing lock exists"
    });
    expect(expiredLockProblem(activeLock, usecase)).toMatchObject({
      expires_at: "2026-05-23T11:00:00Z",
      lock_id: "lock-1",
      status: 409,
      title: "Expired lock cannot be renewed"
    });
    expect(foreignLockProblem(activeLock, usecase)).toMatchObject({
      expires_at: "2026-05-23T11:00:00Z",
      holding_session: "session-2",
      lock_id: "lock-1",
      status: 403,
      title: "Caller does not own this lock"
    });
  });
});

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-2",
    held_by_user_id: "user-2",
    holder: "session-2",
    id: "lock-1",
    mode: "HARD",
    reason: "Edit use case",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function storedUseCase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order"
  };
}
