import type { CompleteSessionInput } from "../../../src/application/session-completion.js";
import type { StoredMergeRequest } from "../../../src/http/merge-request-types.js";
import type {
  StoredLock,
  StoredProject,
  StoredSpecBranch,
  StoredWorkSession
} from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { MergeRequestStore } from "../../../src/ports/merge-request-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import {
  branch,
  lock,
  membership,
  project,
  session
} from "./session-completion-data.js";

export function depsFor(
  options: {
    branch?: StoredSpecBranch;
    deletedLocks?: string[];
    locks?: StoredLock[];
    project?: StoredProject;
    savedMergeRequests?: StoredMergeRequest[];
    session?: StoredWorkSession;
    updatedSessions?: StoredWorkSession[];
  } = {}
) {
  return {
    branchStore: branchStore(options.branch ?? branch()),
    clock: () => "2026-05-20T01:00:00.000Z",
    idFactory: idFactory(),
    lockStore: lockStore(options.locks ?? [lock()], options.deletedLocks ?? []),
    membershipStore: membershipStore(),
    mergeRequestStore: mergeRequestStore(options.savedMergeRequests ?? []),
    projectStore: projectStore(options.project ?? project()),
    workSessionStore: workSessionStore(
      "session" in options ? options.session : session(),
      options.updatedSessions ?? []
    )
  };
}

export function input(
  overrides: Partial<CompleteSessionInput> = {}
): CompleteSessionInput {
  return {
    noMerge: false,
    sessionId: "session-1",
    simulateCompletionFailure: false,
    simulateConflicts: false,
    userId: "user-1",
    ...overrides
  };
}

function branchStore(found: StoredSpecBranch | undefined): BranchStore {
  return {
    findBranchById: () => Promise.resolve(found),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve(found === undefined ? [] : [found]),
    saveBranch: () => Promise.resolve(),
    updateBranch: () => Promise.resolve()
  };
}

function lockStore(locks: StoredLock[], deleted: string[]): LockStore {
  return {
    deleteLock: (lockId) => {
      deleted.push(lockId);
      return Promise.resolve();
    },
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(undefined),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve(locks),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: (_workspaceId, userId) =>
      Promise.resolve(userId === "user-2" ? membership() : undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function mergeRequestStore(saved: StoredMergeRequest[]): MergeRequestStore {
  return {
    findMergeRequestById: () => Promise.resolve(undefined),
    listOpenMergeRequests: () => Promise.resolve([]),
    listOpenMergeRequestsByTargetBranchId: () => Promise.resolve([]),
    saveMergeRequest: (mergeRequest) => {
      saved.push({ ...mergeRequest });
      return Promise.resolve();
    },
    updateMergeRequest: () => Promise.resolve()
  };
}

function projectStore(found: StoredProject | undefined): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(found),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve()
  };
}

function workSessionStore(
  found: StoredWorkSession | undefined,
  updated: StoredWorkSession[]
): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(found),
    listWorkSessions: () => Promise.resolve(found === undefined ? [] : [found]),
    listWorkSessionsForUseCase: () => Promise.resolve([]),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: (nextSession) => {
      updated.push({ ...nextSession });
      return Promise.resolve();
    }
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
}
