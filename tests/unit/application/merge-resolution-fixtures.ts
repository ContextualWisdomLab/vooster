import type { ResolveMergeInput } from "../../../src/application/merge-resolution.js";
import type { StoredMergeRequest } from "../../../src/http/merge-request-types.js";
import type {
  StoredLock,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { MergeRequestStore } from "../../../src/ports/merge-request-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import { featureBranch, mainBranch, membership, mergeRequest, usecase } from "./merge-resolution-data.js";

export function depsFor(options: {
  hardLock?: StoredLock;
  savedRevisions?: StoredRevision[];
  updatedBranches?: StoredSpecBranch[];
  updatedMergeRequests?: StoredMergeRequest[];
  updatedUseCases?: StoredUseCase[];
} = {}) {
  const source = featureBranch();
  const target = mainBranch();
  return {
    branchStore: branchStore(source, target, options.updatedBranches ?? []),
    idFactory: idFactory(),
    lockStore: lockStore(options.hardLock),
    membershipStore: membershipStore(),
    mergeRequestStore: mergeRequestStore(options.updatedMergeRequests ?? []),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    useCaseStore: useCaseStore(options.updatedUseCases ?? [])
  };
}

export function input(overrides: Partial<ResolveMergeInput> = {}): ResolveMergeInput {
  return {
    baseRevision: "merge-current",
    mergeId: "merge-1",
    resolutions: [{ entity_id: "usecase-1", field: "title", strategy: "THEIRS" }],
    simulateWriteFailure: false,
    userId: "user-1",
    ...overrides
  };
}

function branchStore(source: StoredSpecBranch, target: StoredSpecBranch, updated: StoredSpecBranch[]): BranchStore {
  return {
    findBranchById: (branchId) => Promise.resolve([source, target].find((branch) => branch.id === branchId)),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: () => Promise.resolve(),
    updateBranch: (branch) => {
      updated.push({ ...branch });
      return Promise.resolve();
    }
  };
}

function lockStore(hardLock: StoredLock | undefined): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(hardLock),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: (_projectId, userId) => Promise.resolve(userId === "user-1" ? membership() : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function mergeRequestStore(updated: StoredMergeRequest[]): MergeRequestStore {
  return {
    findMergeRequestById: (mergeId) => Promise.resolve(mergeId === "merge-1" ? mergeRequest() : undefined),
    listOpenMergeRequests: () => Promise.resolve([]),
    listOpenMergeRequestsByTargetBranchId: () => Promise.resolve([]),
    saveMergeRequest: () => Promise.resolve(),
    updateMergeRequest: (merge) => {
      updated.push({ ...merge });
      return Promise.resolve();
    }
  };
}

function revisionStore(saved: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(7),
    saveRevision: (revision) => {
      saved.push({ ...revision });
      return Promise.resolve();
    }
  };
}

function useCaseStore(updated: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: (usecaseId) =>
      Promise.resolve(usecaseId === "usecase-1"
        ? { projectId: "project-1", usecase: usecase() }
        : undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([usecase()]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (nextUseCase) => {
      updated.push({ ...nextUseCase });
      return Promise.resolve();
    }
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
}
