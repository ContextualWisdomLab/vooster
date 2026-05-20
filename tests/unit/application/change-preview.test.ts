import { describe, expect, test } from "vitest";
import { previewChange } from "../../../src/application/change-preview.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import type {
  StoredLock,
  StoredMembership,
  StoredRevision,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/http/signup-types.js";

describe("change preview application", () => {
  test("creates a non-committing title preview with active session impact", async () => {
    const result = await previewChange(
      depsFor({
        sessions: [
          session({ pinned_revisions: { "usecase-1": "revision-1" } }),
          session({ id: "session-done", status: "COMPLETED" })
        ]
      }),
      input({ autoCommit: true })
    );

    expect(result).toMatchObject({
      affectedSessions: [
        {
          agent_type: "CODEX",
          id: "session-1",
          owner: "user-1",
          pinned_usecase_keys: ["CHK-001"]
        }
      ],
      preview: {
        base_revision: "revision-1",
        diff: [
          {
            after: "Reviews a refund with audit trail",
            before: "Reviews a refund",
            entity_id: "usecase-1",
            entity_type: "USECASE",
            path: "title",
            severity: "NON_BREAKING"
          }
        ],
        expires_at: "2026-05-20T00:15:00.000Z",
        id: "preview-1",
        severity: "NON_BREAKING",
        usecase_id: "usecase-1"
      },
      status: "PREVIEWED",
      suggestedNextActions: [
        {
          command: "vspec change commit --preview-id preview-1",
          reason: "Commit the preview after human review."
        },
        {
          command: "vspec who CHK-001",
          reason: "Coordinate with active sessions before committing."
        }
      ],
      warnings: [
        {
          message: "NON_BREAKING changes require explicit human commit.",
          type: "AUTO_COMMIT_REFUSED"
        }
      ]
    });
  });

  test("returns failure statuses before creating previews", async () => {
    await expect(previewChange(depsFor({ usecases: [] }), input())).resolves.toEqual({
      status: "USECASE_NOT_FOUND"
    });
    await expect(
      previewChange(depsFor({ membership: undefined }), input())
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });
    await expect(
      previewChange(
        depsFor({
          readOnlyMemberships: new Set(["user-1:workspace-1"])
        }),
        input()
      )
    ).resolves.toEqual({ status: "WRITE_FORBIDDEN" });
    await expect(
      previewChange(
        depsFor(),
        input({
          patch: {
            entityId: "other-usecase",
            title: "Reviews a refund with audit trail"
          }
        })
      )
    ).resolves.toEqual({ status: "PATCH_TARGET_MISMATCH" });
    await expect(
      previewChange(depsFor({ lock: hardLock() }), input())
    ).resolves.toEqual({
      lock: hardLock(),
      status: "HARD_LOCKED",
      usecase: usecase()
    });
    await expect(
      previewChange(
        depsFor({
          revision: revision({ id: "revision-current", severity: "BREAKING" })
        }),
        input({ baseRevision: "revision-stale" })
      )
    ).resolves.toEqual({
      currentRevision: revision({ id: "revision-current", severity: "BREAKING" }),
      status: "STALE_BASE",
      usecase: usecase()
    });
  });
});

function depsFor(
  options: {
    lock?: StoredLock;
    membership?: StoredMembership;
    readOnlyMemberships?: ReadonlySet<string>;
    revision?: StoredRevision;
    sessions?: StoredWorkSession[];
    usecases?: StoredUseCase[];
  } = {}
) {
  return {
    clock: () => new Date("2026-05-20T00:00:00.000Z"),
    idFactory: () => "preview-1",
    lockStore: lockStore(options.lock),
    membershipStore: membershipStore(
      "membership" in options ? options.membership : membership()
    ),
    readOnlyMemberships: options.readOnlyMemberships ?? new Set(),
    revisionStore: revisionStore(options.revision ?? revision()),
    useCaseStore: useCaseStore(options.usecases ?? [usecase()]),
    workSessionStore: workSessionStore(options.sessions ?? [])
  };
}

function input(overrides: Partial<Parameters<typeof previewChange>[1]> = {}) {
  return {
    autoCommit: false,
    baseRevision: "revision-1",
    patch: {
      entityId: "usecase-1",
      title: "Reviews a refund with audit trail"
    },
    usecaseKey: "CHK-001",
    userId: "user-1",
    ...overrides
  };
}

function lockStore(lock: StoredLock | undefined): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(lock),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(membership: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(membership),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function revisionStore(revision: StoredRevision): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(revision),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function useCaseStore(usecases: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: (key) =>
      Promise.resolve(usecases.filter((candidate) => candidate.key === key)),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: () => Promise.resolve(sessions),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
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

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P2",
    project_id: "project-1",
    scope: "chk",
    status: "DRAFT",
    title: "Reviews a refund",
    ...overrides
  };
}

function revision(overrides: Partial<StoredRevision> = {}): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    severity: "NON_BREAKING",
    snapshot: usecase(),
    version_number: 1,
    ...overrides
  };
}

function hardLock(): StoredLock {
  return {
    expires_at: "2026-05-20T00:10:00.000Z",
    held_by_session_id: "session-lock",
    holder: "session-lock",
    mode: "HARD",
    reason: "Locked for edit",
    usecase_id: "usecase-1"
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    agent_type: "CODEX",
    id: "session-1",
    pinned_revisions: {},
    status: "ACTIVE",
    user_id: "user-1",
    ...overrides
  };
}
