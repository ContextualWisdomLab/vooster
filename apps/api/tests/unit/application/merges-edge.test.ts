import { describe, expect, test } from "vitest";
import { openMerge } from "../../../src/application/merges.js";
import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch
} from "../../../src/domain/entities/index.js";

type Deps = Parameters<typeof openMerge>[0];
type Input = Parameters<typeof openMerge>[1];

describe("merge application edge cases", () => {
  test("rejects missing source branches before authorization", async () => {
    await expect(openMerge(depsFor({ source: null }), input())).resolves.toEqual({
      status: "SOURCE_NOT_FOUND"
    });
  });

  test("rejects users without project membership", async () => {
    await expect(openMerge(depsFor({ member: false }), input())).resolves.toEqual({
      status: "ACCESS_DENIED"
    });
  });

  test("rejects sources without an active target branch", async () => {
    await expect(openMerge(depsFor({ target: null }), input())).resolves.toEqual({
      status: "SOURCE_NOT_ACTIVE"
    });
  });
});

function depsFor(
  options: {
    member?: boolean;
    project?: StoredProject | null;
    source?: StoredSpecBranch | null;
    target?: StoredSpecBranch | null;
  } = {}
): Deps {
  const source = option(options.source, featureBranch());
  const target = option(options.target, mainBranch());
  const project = option(options.project, storedProject());

  return {
    branchStore: {
      findBranchById: (branchId) =>
        Promise.resolve([source, target].find((branch) => branch?.id === branchId))
    } as Deps["branchStore"],
    lockStore: {} as Deps["lockStore"],
    membershipStore: {
      membershipForProject: () =>
        Promise.resolve(options.member === false ? undefined : membership()),
      membershipForWorkspace: () => Promise.resolve(undefined),
      membershipsForUser: () => Promise.resolve([]),
      saveMembership: () => Promise.resolve()
    },
    mergeRequestStore: {} as Deps["mergeRequestStore"],
    projectStore: {
      findProjectById: (projectId) =>
        Promise.resolve(project?.id === projectId ? project : undefined)
    } as Deps["projectStore"],
    revisionStore: {} as Deps["revisionStore"],
    useCaseStore: {} as Deps["useCaseStore"]
  };
}

function option<T>(value: T | null | undefined, fallback: T): T | undefined {
  return value === null ? undefined : (value ?? fallback);
}

function input(overrides: Partial<Input> = {}): Input {
  return {
    simulateWriteFailure: false,
    sourceBranchId: "branch-feature",
    strategy: undefined,
    userId: "user-1",
    ...overrides
  };
}

function featureBranch(): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    base_revision_ids: { "usecase-1": "revision-base" },
    head_revision_ids: { "usecase-1": "revision-branch" },
    id: "branch-feature",
    name: "feature/refund",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
  };
}

function mainBranch(): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: { "usecase-1": "revision-base" },
    id: "branch-main",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
  };
}

function storedProject(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "MRG",
    name: "Merge",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
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
