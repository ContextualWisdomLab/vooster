import { describe, expect, test } from "vitest";
import { openMerge } from "../../../src/application/merges.js";
import type { StoredMergeRequest } from "../../../src/domain/entities/index.js";
import type {
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { MergeRequestStore } from "../../../src/ports/merge-request-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("merges application", () => {
  test("fast-forwards a clean active branch", async () => {
    const savedMergeRequests: StoredMergeRequest[] = [];
    const updatedBranches: StoredSpecBranch[] = [];
    const updatedMergeRequests: StoredMergeRequest[] = [];

    const result = await openMerge(
      depsFor({ savedMergeRequests, updatedBranches, updatedMergeRequests }),
      createInput()
    );

    expect(result.status).toBe("MERGED");
    if (result.status !== "MERGED") {
      throw new Error("expected clean merge");
    }
    expect(result.mergeRequest).toMatchObject({
      conflicts: [],
      current_revision_id: "id-2",
      id: "id-1",
      source_branch_id: "branch-feature",
      status: "MERGED",
      strategy: "FAST_FORWARD",
      target_branch_id: "branch-main"
    });
    expect(result.mainHeadRevisionIds).toEqual({ "usecase-1": "revision-branch" });
    expect(savedMergeRequests).toHaveLength(1);
    expect(updatedBranches.map((branch) => branch.id)).toEqual([
      "branch-main",
      "branch-feature"
    ]);
    expect(updatedBranches[0]?.head_revision_ids).toEqual({
      "usecase-1": "revision-branch"
    });
    expect(updatedBranches[1]).toMatchObject({
      merged_at: "2026-05-20T00:00:00.000Z",
      status: "MERGED"
    });
    expect(updatedMergeRequests).toEqual([result.mergeRequest]);
  });

  test("rejects forced fast-forward after main advances without saving a merge request", async () => {
    const savedMergeRequests: StoredMergeRequest[] = [];

    const result = await openMerge(
      depsFor({
        savedMergeRequests,
        source: featureBranch({
          base_revision_ids: { "usecase-1": "revision-base" },
          head_revision_ids: { "usecase-1": "revision-branch" }
        }),
        target: mainBranch({ head_revision_ids: { "usecase-1": "revision-main" } })
      }),
      createInput({ strategy: "FAST_FORWARD" })
    );

    expect(result.status).toBe("FAST_FORWARD_REJECTED");
    if (result.status !== "FAST_FORWARD_REJECTED") {
      throw new Error("expected fast-forward rejection");
    }
    expect(result.sourceBranch.name).toBe("feature/refund");
    expect(result.mainHeadRevisionIds).toEqual({ "usecase-1": "revision-main" });
    expect(savedMergeRequests).toEqual([]);
  });

  test("keeps merge requests open for conflicts, hard locks, and write failures", async () => {
    const conflictResult = await openMerge(
      depsFor({
        source: featureBranch({
          base_revision_ids: { "usecase-1": "revision-base" },
          head_revision_ids: { "usecase-1": "revision-branch" }
        }),
        target: mainBranch({ head_revision_ids: { "usecase-1": "revision-main" } })
      }),
      createInput()
    );

    expect(conflictResult.status).toBe("CONFLICTS");
    if (conflictResult.status !== "CONFLICTS") {
      throw new Error("expected conflicts");
    }
    expect(conflictResult.mergeRequest).toMatchObject({
      status: "OPEN",
      strategy: "SQUASH"
    });
    expect(conflictResult.mergeRequest.conflicts).toContainEqual({
      entity_id: "usecase-1",
      entity_type: "USECASE",
      field: "title",
      mine_value: "Branch title",
      theirs_value: "Main title",
      type: "STRUCTURAL"
    });

    await expect(
      openMerge(
        depsFor({
          hardLock: lock(),
          source: featureBranch({
            head_revision_ids: { "usecase-1": "revision-branch" }
          })
        }),
        createInput()
      )
    ).resolves.toMatchObject({
      holdingSession: "session-lock-holder",
      status: "HARD_LOCK"
    });

    await expect(
      openMerge(depsFor(), createInput({ simulateWriteFailure: true }))
    ).resolves.toMatchObject({
      exitCode: 5,
      status: "WRITE_FAILED"
    });
  });
});

function depsFor(
  options: {
    hardLock?: StoredLock;
    savedMergeRequests?: StoredMergeRequest[];
    source?: StoredSpecBranch;
    target?: StoredSpecBranch;
    updatedBranches?: StoredSpecBranch[];
    updatedMergeRequests?: StoredMergeRequest[];
  } = {}
) {
  const source = options.source ?? featureBranch();
  const target = options.target ?? mainBranch();
  return {
    branchStore: branchStore(source, target, options.updatedBranches ?? []),
    idFactory: idFactory(),
    lockStore: lockStore(options.hardLock),
    membershipStore: membershipStore(),
    mergeRequestStore: mergeRequestStore(
      options.savedMergeRequests ?? [],
      options.updatedMergeRequests ?? []
    ),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    projectStore: projectStore(),
    revisionStore: revisionStore(),
    useCaseStore: useCaseStore()
  };
}

function branchStore(
  source: StoredSpecBranch,
  target: StoredSpecBranch,
  updatedBranches: StoredSpecBranch[]
): BranchStore {
  return {
    findBranchById: (branchId) =>
      Promise.resolve([source, target].find((branch) => branch.id === branchId)),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: () => Promise.resolve(),
    updateBranch: (branch) => {
      updatedBranches.push({ ...branch });
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
    membershipForProject: (_projectId, userId) =>
      Promise.resolve(userId === "user-1" ? membership() : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function mergeRequestStore(
  savedMergeRequests: StoredMergeRequest[],
  updatedMergeRequests: StoredMergeRequest[]
): MergeRequestStore {
  return {
    findMergeRequestById: () => Promise.resolve(undefined),
    listOpenMergeRequests: () => Promise.resolve([]),
    listOpenMergeRequestsByTargetBranchId: () => Promise.resolve([]),
    saveMergeRequest: (mergeRequest) => {
      savedMergeRequests.push({ ...mergeRequest });
      return Promise.resolve();
    },
    updateMergeRequest: (mergeRequest) => {
      updatedMergeRequests.push({ ...mergeRequest });
      return Promise.resolve();
    }
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

function revisionStore(): RevisionStore {
  return {
    findRevisionById: (revisionId) =>
      Promise.resolve(
        revisionId === "revision-branch"
          ? revision("revision-branch", "Branch title")
          : revisionId === "revision-main"
            ? revision("revision-main", "Main title")
            : undefined
      ),
    latestRevision: (entityId) =>
      Promise.resolve(
        entityId === "usecase-1" ? revision("revision-latest") : undefined
      ),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: (usecaseId) =>
      Promise.resolve(
        usecaseId === "usecase-1"
          ? { projectId: "project-1", usecase: usecase() }
          : undefined
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([usecase()]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function createInput(overrides: Partial<Parameters<typeof openMerge>[1]> = {}) {
  return {
    simulateWriteFailure: false,
    sourceBranchId: "branch-feature",
    strategy: undefined,
    userId: "user-1",
    ...overrides
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
}

function mainBranch(overrides: Partial<StoredSpecBranch> = {}): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: { "usecase-1": "revision-base" },
    id: "branch-main",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE",
    ...overrides
  };
}

function featureBranch(overrides: Partial<StoredSpecBranch> = {}): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    base_revision_ids: { "usecase-1": "revision-base" },
    head_revision_ids: { "usecase-1": "revision-branch" },
    id: "branch-feature",
    name: "feature/refund",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE",
    ...overrides
  };
}

function lock(): StoredLock {
  return {
    expires_at: "2026-06-01T00:00:00.000Z",
    holder: "session-lock-holder",
    mode: "HARD",
    reason: "Another session owns the target.",
    usecase_id: "usecase-1"
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

function revision(id: string, title = "Title"): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    severity: "NON_BREAKING",
    snapshot: { ...usecase(), title },
    version_number: 1
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-base",
    format: "BRIEF",
    id: "usecase-1",
    key: "MRG-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Original title"
  };
}
