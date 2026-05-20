import type { UseCaseArchiveInput } from "../../../src/application/usecase-archive.js";
import type {
  StoredLock,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import { mainBranch, membership, project, usecase } from "./usecase-archive-data.js";

export function depsFor(
  options: {
    branch?: StoredSpecBranch;
    locks?: StoredLock[];
    savedRevisions?: StoredRevision[];
    sessions?: StoredWorkSession[];
    updatedBranches?: StoredSpecBranch[];
    updatedUseCases?: StoredUseCase[];
    usecase?: StoredUseCase;
  } = {}
) {
  return {
    branchStore: branchStore(
      options.branch ?? mainBranch(),
      options.updatedBranches ?? []
    ),
    clock: () => "2026-05-20T00:00:00.000Z",
    idFactory: idFactory(),
    lockStore: lockStore(options.locks ?? []),
    membershipStore: membershipStore(),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    useCaseStore: useCaseStore(
      "usecase" in options ? options.usecase : usecase(),
      options.updatedUseCases ?? []
    ),
    workSessionStore: workSessionStore(options.sessions ?? [])
  };
}

export function input(
  overrides: Partial<UseCaseArchiveInput> = {}
): UseCaseArchiveInput {
  return {
    hardDeleteRequested: false,
    usecaseId: "usecase-1",
    userId: "user-1",
    ...overrides
  };
}

function branchStore(
  branch: StoredSpecBranch | undefined,
  updated: StoredSpecBranch[]
): BranchStore {
  return {
    findBranchById: () => Promise.resolve(branch),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve(branch === undefined ? [] : [branch]),
    saveBranch: () => Promise.resolve(),
    updateBranch: (nextBranch) => {
      updated.push({ ...nextBranch });
      return Promise.resolve();
    }
  };
}

function lockStore(locks: StoredLock[]): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(locks[0]),
    listLocksForUseCase: () => Promise.resolve(locks),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: (_projectId, userId) =>
      Promise.resolve(userId === "user-1" ? membership() : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(project()),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(saved: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(2),
    saveRevision: (revision) => {
      saved.push({ ...revision });
      return Promise.resolve();
    }
  };
}

function useCaseStore(
  found: StoredUseCase | undefined,
  updated: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(
        found === undefined ? undefined : { projectId: "project-1", usecase: found }
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(found === undefined ? [] : [found]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (nextUseCase) => {
      updated.push({ ...nextUseCase });
      return Promise.resolve();
    }
  };
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve(sessions),
    listWorkSessionsForUseCase: () => Promise.resolve(sessions),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
}
