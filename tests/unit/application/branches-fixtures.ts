import type { CreateBranchInput } from "../../../src/application/branches.js";
import type { StoredMergeRequest } from "../../../src/http/merge-request-types.js";
import type {
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { MergeRequestStore } from "../../../src/ports/merge-request-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import { mainBranch, usecase } from "./branches-data.js";

export function depsFor(options: {
  baseBranch?: StoredSpecBranch;
  existingBranches?: StoredSpecBranch[];
  latestRevisionId?: string;
  mergeRequests?: StoredMergeRequest[];
  readOnly?: boolean;
  savedBranches?: StoredSpecBranch[];
  usecases?: StoredUseCase[];
} = {}) {
  const baseBranch = options.baseBranch ?? mainBranch();
  return {
    branchStore: branchStore(
      baseBranch === undefined ? [] : [baseBranch],
      options.existingBranches,
      options.savedBranches ?? []
    ),
    idFactory: () => "branch-new",
    isReadOnlyMembership: () => options.readOnly === true,
    membershipStore: membershipStore(),
    mergeRequestStore: mergeRequestStore(options.mergeRequests ?? []),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.latestRevisionId),
    useCaseStore: useCaseStore(options.usecases ?? [usecase()])
  };
}

export function input(overrides: Partial<CreateBranchInput> = {}): CreateBranchInput {
  return {
    from: "main",
    name: "feature/refund",
    projectId: "project-1",
    simulateSnapshotFailure: false,
    userId: "user-1",
    ...overrides
  };
}

function branchStore(
  baseBranches: StoredSpecBranch[],
  existingBranches: StoredSpecBranch[] | undefined,
  savedBranches: StoredSpecBranch[]
): BranchStore {
  const branches = existingBranches ?? baseBranches;
  return {
    findBranchById: (branchId) => Promise.resolve(baseBranches.find((branch) => branch.id === branchId)),
    findBranchByProjectAndName: (_projectId, name) =>
      Promise.resolve(branches.find((branch) => branch.name === name)),
    listBranches: () => Promise.resolve(branches),
    saveBranch: (branch) => {
      savedBranches.push({ ...branch });
      return Promise.resolve();
    },
    updateBranch: () => Promise.resolve()
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

function mergeRequestStore(mergeRequests: StoredMergeRequest[]): MergeRequestStore {
  return {
    findMergeRequestById: () => Promise.resolve(undefined),
    listOpenMergeRequests: () => Promise.resolve([]),
    listOpenMergeRequestsByTargetBranchId: (targetBranchId) =>
      Promise.resolve(
        mergeRequests.filter((mergeRequest) => mergeRequest.target_branch_id === targetBranchId)
      ),
    saveMergeRequest: () => Promise.resolve(),
    updateMergeRequest: () => Promise.resolve()
  };
}

function projectStore(): ProjectStore {
  return {
    findProjectById: (projectId) =>
      Promise.resolve(projectId === "project-1" ? project() : undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(latestRevisionId = "revision-latest"): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: (entityId) =>
      Promise.resolve(latestRevisionId === undefined ? undefined : revision(entityId, latestRevisionId)),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function useCaseStore(usecases: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(usecases),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
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

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "MRG",
    name: "Merge",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function revision(entityId: string, revisionId: string): StoredRevision {
  return {
    entity_id: entityId,
    entity_type: "USECASE",
    id: revisionId,
    severity: "NON_BREAKING",
    snapshot: {},
    version_number: 1
  };
}
