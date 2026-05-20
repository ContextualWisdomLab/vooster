import type {
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import {
  defaultBranch,
  defaultProject,
  membership,
  revisions,
  usecase
} from "./revision-revert-data.js";

export { lock, revisions, session, usecase } from "./revision-revert-data.js";

export type RevertFixtureDeps = {
  branchStore: BranchStore;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export function depsFor(
  options: {
    branch?: StoredSpecBranch;
    lock?: StoredLock;
    membership?: StoredMembership | null;
    project?: StoredProject | null;
    revisions?: StoredRevision[];
    savedRevisions?: StoredRevision[];
    sessions?: StoredWorkSession[];
    updatedBranches?: StoredSpecBranch[];
    updatedUseCases?: StoredUseCase[];
    usecase?: StoredUseCase | null;
  } = {}
): RevertFixtureDeps {
  const branch = options.branch ?? defaultBranch();
  const project = "project" in options ? options.project : defaultProject(branch.id);
  return {
    branchStore: branchStore(branch, options.updatedBranches ?? []),
    lockStore: lockStore(options.lock),
    membershipStore: membershipStore(options.membership),
    projectStore: projectStore(project),
    revisionStore: revisionStore(
      options.revisions ?? revisions(),
      options.savedRevisions ?? []
    ),
    useCaseStore: useCaseStore(
      "usecase" in options ? (options.usecase ?? null) : usecase(),
      options.updatedUseCases ?? []
    ),
    workSessionStore: workSessionStore(options.sessions ?? [])
  };
}

export function revertInput(
  overrides: Partial<{
    force: boolean;
    revisionId: string;
    simulateGherkinDrift: boolean;
    simulateWriteFailure: boolean;
    usecaseId: string;
    userId: string | undefined;
  }> = {}
) {
  return {
    force: false,
    revisionId: "revision-target",
    simulateGherkinDrift: false,
    simulateWriteFailure: false,
    usecaseId: "usecase-1",
    userId: "user-1",
    ...overrides
  };
}

function branchStore(
  branch: StoredSpecBranch,
  updated: StoredSpecBranch[]
): BranchStore {
  return {
    findBranchById: () => Promise.resolve(branch),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: () => Promise.resolve(),
    updateBranch: (nextBranch) => {
      updated.push(nextBranch);
      return Promise.resolve();
    }
  };
}

function lockStore(value: StoredLock | undefined): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(value),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
  };
}

function membershipStore(value: StoredMembership | null | undefined): MembershipStore {
  return {
    membershipForProject: () =>
      Promise.resolve(value === null ? undefined : membership()),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(value: StoredProject | null | undefined): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(value ?? undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(
  revisionsForUseCase: StoredRevision[],
  saved: StoredRevision[]
): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve(revisionsForUseCase),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: (revision) => {
      saved.push(revision);
      return Promise.resolve();
    }
  };
}

function useCaseStore(
  value: StoredUseCase | null,
  updated: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(
        value === null ? undefined : { projectId: value.project_id, usecase: value }
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updatedUsecase) => {
      updated.push(updatedUsecase);
      return Promise.resolve();
    }
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
