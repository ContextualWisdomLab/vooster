import { describe, expect, test } from "vitest";
import type {
  StoredLock,
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import {
  archivedPinProblem,
  hardLockedPinProblem,
  resolvePins,
  semanticLockConflict,
  semanticLockProblem
} from "../../../src/http/session-pin-support.js";
import type { SignupState } from "../../../src/http/signup-types.js";

const signupState: SignupState = {
  pendingOAuth: new Map(),
  readOnlyMemberships: new Set(),
  sessionsByToken: new Map()
};

describe("session pin support", () => {
  test("resolves pins with latest revision ids when all use cases are available", async () => {
    const checkout = storedUseCase({ current_revision_id: "revision-fallback" });
    const refund = storedUseCase({ id: "usecase-2", key: "PAY-002" });

    await expect(
      resolvePins(
        signupState,
        lockStore({}),
        revisionStore({ revisions: { "usecase-1": revision("revision-latest") } }),
        useCaseStore([checkout, refund]),
        "project-1",
        ["PAY-001", "PAY-002"]
      )
    ).resolves.toMatchObject({
      keys: ["PAY-001", "PAY-002"],
      revisions: {
        "usecase-1": "revision-latest",
        "usecase-2": "revision-current"
      },
      status: "OK",
      usecases: [checkout, refund]
    });
  });

  test("returns the first missing, archived, or hard locked pin problem", async () => {
    await expect(
      resolvePins(
        signupState,
        lockStore({}),
        revisionStore({}),
        useCaseStore([]),
        "project-1",
        ["PAY-404"]
      )
    ).resolves.toEqual({ key: "PAY-404", status: "MISSING" });

    await expect(
      resolvePins(
        signupState,
        lockStore({}),
        revisionStore({}),
        useCaseStore([storedUseCase({ archived_at: "2026-05-23T00:00:00Z" })]),
        "project-1",
        ["PAY-001"]
      )
    ).resolves.toEqual({ key: "PAY-001", status: "ARCHIVED" });

    await expect(
      resolvePins(
        signupState,
        lockStore({ locks: { "usecase-1": lock({ mode: "HARD" }) } }),
        revisionStore({}),
        useCaseStore([storedUseCase()]),
        "project-1",
        ["PAY-001"]
      )
    ).resolves.toEqual({
      holder: "session-2",
      key: "PAY-001",
      status: "HARD_LOCKED"
    });
  });

  test("serializes archived and hard lock pin problems with recovery commands", () => {
    expect(archivedPinProblem("PAY-001")).toMatchObject({
      offending_key: "PAY-001",
      status: 422,
      suggested_next_actions: [
        {
          command: "vspec usecase restore PAY-001",
          reason: "Restore the archived use case before pinning it."
        }
      ],
      title: "Pinned use case is archived"
    });
    expect(hardLockedPinProblem("PAY-001", "session-2")).toMatchObject({
      holding_session: "session-2",
      offending_key: "PAY-001",
      status: 409,
      title: "Pinned use case is hard-locked"
    });
  });

  test("detects semantic locks across pinned use cases", async () => {
    const pinned = {
      keys: ["PAY-001", "PAY-002"],
      revisions: {},
      status: "OK" as const,
      usecases: [storedUseCase(), storedUseCase({ id: "usecase-2", key: "PAY-002" })]
    };

    await expect(
      semanticLockConflict(
        lockStore({ locks: { "usecase-2": lock({ mode: "SEMANTIC" }) } }),
        pinned
      )
    ).resolves.toEqual({ holder: "session-2", key: "PAY-002" });
    await expect(semanticLockConflict(lockStore({}), pinned)).resolves.toBeUndefined();
  });

  test("serializes semantic lock conflicts without marking created resources", () => {
    expect(semanticLockProblem("PAY-001", "session-2")).toMatchObject({
      conflicting_session: "session-2",
      created_branch: false,
      created_session: false,
      status: 409,
      title: "Pinned use case has a semantic lock"
    });
  });
});

function useCaseStore(usecases: StoredUseCase[]): UseCaseStore {
  return {
    listUseCases: () => Promise.resolve(usecases)
  } as unknown as UseCaseStore;
}

function lockStore(options: { locks?: Record<string, StoredLock> }): LockStore {
  return {
    findLockForUseCase: (usecaseId: string) =>
      Promise.resolve(options.locks?.[usecaseId])
  } as unknown as LockStore;
}

function revisionStore(options: {
  revisions?: Record<string, StoredRevision>;
}): RevisionStore {
  return {
    latestRevision: (usecaseId: string) =>
      Promise.resolve(options.revisions?.[usecaseId])
  } as unknown as RevisionStore;
}

function storedUseCase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order",
    ...overrides
  };
}

function revision(id: string): StoredRevision {
  const usecase = storedUseCase();
  return {
    entity_id: usecase.id,
    entity_type: "USECASE",
    id,
    snapshot: usecase,
    version_number: 2
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-2",
    held_by_user_id: "user-2",
    holder: "session-2",
    mode: "HARD",
    reason: "Edit use case",
    usecase_id: "usecase-1",
    ...overrides
  };
}
