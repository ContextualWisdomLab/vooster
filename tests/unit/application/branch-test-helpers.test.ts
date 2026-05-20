import { describe, expect, test } from "vitest";
import {
  advanceBranchExtensionRevision,
  advanceBranchUseCaseRevision,
  advanceMainExtensionRevision,
  advanceMainUseCaseRevision
} from "../../../src/application/branch-test-helpers.js";
import type { StoredRevision, StoredSpecBranch, StoredUseCase } from "../../../src/http/signup-types.js";
describe("branch test helper application", () => {
  test("creates a branch use case revision and advances the branch head", async () => {
    const savedRevisions: StoredRevision[] = [], updatedBranches: StoredSpecBranch[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await advanceBranchUseCaseRevision(
      depsFor({ savedRevisions, updatedBranches, updatedUseCases }),
      {
        branchId: "branch-feature",
        severity: "BREAKING",
        title: "Branch title",
        usecaseId: "usecase-1"
      }
    );

    expect(result).toEqual({ revisionId: "id-1", status: "ADVANCED" });
    expect(savedRevisions[0]).toMatchObject({
      branch_id: "branch-feature",
      entity_id: "usecase-1",
      id: "id-1",
      severity: "BREAKING",
      snapshot: { title: "Branch title" },
      version_number: 2
    });
    expect(updatedBranches[0]?.head_revision_ids).toEqual({ "usecase-1": "id-1" });
    expect(updatedUseCases[0]?.title).toBe("Original title");
    await expect(
      advanceBranchUseCaseRevision(depsFor({ branch: undefined }), {
        branchId: "missing",
        severity: "COSMETIC",
        title: "Missing",
        usecaseId: "usecase-1"
      })
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });

  test("creates a main use case revision and advances canonical state", async () => {
    const savedRevisions: StoredRevision[] = [], updatedBranches: StoredSpecBranch[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await advanceMainUseCaseRevision(
      depsFor({ savedRevisions, updatedBranches, updatedUseCases }),
      { severity: "NON_BREAKING", title: "Main title", usecaseId: "usecase-1" }
    );

    expect(result).toEqual({ revisionId: "id-1", status: "ADVANCED" });
    expect(savedRevisions[0]).toMatchObject({
      id: "id-1",
      severity: "NON_BREAKING",
      snapshot: { title: "Main title" }
    });
    expect(savedRevisions[0]).not.toHaveProperty("branch_id");
    expect(updatedUseCases[0]).toMatchObject({
      current_revision_id: "id-1",
      title: "Main title"
    });
    expect(updatedBranches[0]?.head_revision_ids).toEqual({ "usecase-1": "id-1" });
  });

  test("creates extension revisions for branch and main helpers", async () => {
    const branchRevisions: StoredRevision[] = [];
    const branchResult = await advanceBranchExtensionRevision(
      depsFor({ savedRevisions: branchRevisions }),
      {
        branchId: "branch-feature",
        condition: "Alternate flow",
        extensionPoint: "1",
        usecaseId: "usecase-1"
      }
    );

    const mainRevisions: StoredRevision[] = [], mainUseCases: StoredUseCase[] = [];
    const mainResult = await advanceMainExtensionRevision(
      depsFor({ savedRevisions: mainRevisions, updatedUseCases: mainUseCases }),
      { condition: "Main alternate", extensionPoint: "2", usecaseId: "usecase-1" }
    );

    expect(branchResult).toEqual({ revisionId: "id-1", status: "ADVANCED" });
    expect(branchRevisions[0]).toMatchObject({
      branch_id: "branch-feature",
      change_summary: "extension:1:Alternate flow",
      severity: "NON_BREAKING"
    });
    expect(mainResult).toEqual({ revisionId: "id-1", status: "ADVANCED" });
    expect(mainRevisions[0]).toMatchObject({
      change_summary: "extension:2:Main alternate",
      severity: "NON_BREAKING"
    });
    expect(mainRevisions[0]).not.toHaveProperty("branch_id");
    expect(mainUseCases[0]?.current_revision_id).toBe("id-1");
  });
});

function depsFor(overrides: {
  branch?: StoredSpecBranch | undefined;
  savedRevisions?: StoredRevision[];
  updatedBranches?: StoredSpecBranch[];
  updatedUseCases?: StoredUseCase[];
  usecase?: StoredUseCase | undefined;
} = {}) {
  const savedRevisions = overrides.savedRevisions ?? [];
  const updatedBranches = overrides.updatedBranches ?? [];
  const updatedUseCases = overrides.updatedUseCases ?? [];
  const currentUsecase = "usecase" in overrides ? overrides.usecase : usecase();
  const featureBranch = "branch" in overrides
    ? overrides.branch
    : branch("branch-feature", { base_revision_ids: { "usecase-1": "revision-current" } });
  const mainBranch = branch("branch-main");

  return {
    branchStore: {
      findBranchById: (id: string) => Promise.resolve(id === "branch-main" ? mainBranch : featureBranch),
      findBranchByProjectAndName: () => Promise.resolve(undefined),
      listBranches: () => Promise.resolve([]),
      saveBranch: () => Promise.resolve(),
      updateBranch: (stored: StoredSpecBranch) => {
        updatedBranches.push(stored);
        return Promise.resolve();
      }
    },
    idFactory: () => "id-1",
    projectStore: {
      findProjectById: () => Promise.resolve({
        default_branch_id: "branch-main",
        id: "project-1",
        key: "PRJ",
        name: "Project",
        visibility: "INTERNAL" as const,
        workspace_id: "workspace-1"
      }),
      findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
      listProjectsForWorkspace: () => Promise.resolve([]),
      saveProject: () => Promise.resolve()
    },
    revisionStore: {
      findRevisionById: () => Promise.resolve(undefined),
      latestRevision: () => Promise.resolve(undefined),
      listRevisions: () => Promise.resolve([]),
      nextVersionNumber: () => Promise.resolve(2),
      saveRevision: (revision: StoredRevision) => {
        savedRevisions.push(revision);
        return Promise.resolve();
      }
    },
    useCaseStore: {
      findUseCaseById: () => Promise.resolve(currentUsecase),
      findUseCaseWithProject: () =>
        Promise.resolve(
          currentUsecase === undefined
            ? undefined
            : { projectId: "project-1", usecase: currentUsecase }
        ),
      findUseCasesByKey: () => Promise.resolve([]),
      listUseCases: () => Promise.resolve([]),
      saveUseCase: () => Promise.resolve(),
      updateUseCase: (stored: StoredUseCase) => {
        updatedUseCases.push(stored);
        return Promise.resolve();
      }
    }
  };
}

function branch(id: string, overrides: Partial<StoredSpecBranch> = {}): StoredSpecBranch {
  return {
    base_branch_id: null,
    id,
    name: id === "branch-main" ? "main" : "feature",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    ...overrides
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "UC-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "IN_SCOPE",
    status: "DRAFT",
    title: "Original title"
  };
}
