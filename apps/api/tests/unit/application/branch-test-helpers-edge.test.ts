import { describe, expect, test } from "vitest";
import {
  advanceBranchExtensionRevision,
  advanceMainExtensionRevision,
  advanceMainUseCaseRevision
} from "../../../src/application/branch-test-helpers.js";
import type {
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

type Deps = Parameters<typeof advanceMainUseCaseRevision>[0];

describe("branch test helper edge cases", () => {
  test("returns not found when a branch extension target is missing", async () => {
    await expect(
      advanceBranchExtensionRevision(depsFor({ branch: undefined }), {
        branchId: "missing",
        condition: "Alternate",
        extensionPoint: "1",
        usecaseId: "usecase-1"
      })
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });

  test("returns not found when a main use case target is missing", async () => {
    await expect(
      advanceMainUseCaseRevision(depsFor({ usecase: undefined }), {
        severity: "NON_BREAKING",
        title: "Missing",
        usecaseId: "missing"
      })
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });

  test("returns not found when a main extension target is missing", async () => {
    await expect(
      advanceMainExtensionRevision(depsFor({ usecase: undefined }), {
        condition: "Missing alternate",
        extensionPoint: "2",
        usecaseId: "missing"
      })
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });
});

function depsFor(options: {
  branch?: StoredSpecBranch;
  usecase?: StoredUseCase;
}): Deps {
  return {
    branchStore: {
      findBranchById: () => Promise.resolve(options.branch)
    } as unknown as Deps["branchStore"],
    projectStore: {} as Deps["projectStore"],
    revisionStore: {} as Deps["revisionStore"],
    useCaseStore: {
      findUseCaseWithProject: () =>
        Promise.resolve(
          options.usecase === undefined
            ? undefined
            : { projectId: "project-1", usecase: options.usecase }
        )
    } as unknown as Deps["useCaseStore"]
  };
}
