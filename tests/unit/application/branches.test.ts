import { describe, expect, test } from "vitest";
import { createBranch } from "../../../src/application/branches.js";
import type { StoredSpecBranch } from "../../../src/http/signup-types.js";
import { mainBranch, mergeRequest, usecase } from "./branches-data.js";
import { depsFor, input } from "./branches-fixtures.js";

describe("branches application", () => {
  test("creates a human branch from the main head snapshot", async () => {
    const savedBranches: StoredSpecBranch[] = [];

    const result = await createBranch(
      depsFor({
        mergeRequests: [mergeRequest()],
        savedBranches
      }),
      input()
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected branch creation success");
    }
    expect(result.branch).toMatchObject({
      base_branch_id: "branch-main",
      base_revision_ids: { "usecase-1": "revision-latest" },
      head_revision_ids: { "usecase-1": "revision-latest" },
      id: "branch-new",
      name: "feature/refund",
      owner_id: "user-1",
      owner_type: "HUMAN",
      project_id: "project-1",
      status: "ACTIVE"
    });
    expect(savedBranches).toEqual([result.branch]);
    expect(result.warnings).toEqual([
      { merge_request_id: "merge-1", type: "IN_FLIGHT_MERGE_REQUEST" }
    ]);
    expect(result.suggestedNextActions).toEqual([
      {
        command: "vspec branch checkout feature/refund",
        reason: "Switch to the isolated branch."
      },
      {
        command: "vspec usecase edit MRG-001",
        reason: "Start editing a use case on the branch."
      }
    ]);
  });

  test("rejects access, read-only, non-main, missing branch, and snapshot failures", async () => {
    await expect(createBranch(depsFor(), input({ userId: undefined }))).resolves.toEqual({
      status: "ACCESS_DENIED"
    });
    await expect(createBranch(depsFor({ readOnly: true }), input())).resolves.toEqual({
      status: "READ_ONLY"
    });
    await expect(createBranch(depsFor(), input({ from: "feature/base" }))).resolves.toEqual({
      branchName: "feature/refund",
      status: "NON_MAIN_BASE"
    });
    await expect(
      createBranch(depsFor({ baseBranch: undefined }), input())
    ).resolves.toEqual({
      status: "PROJECT_BRANCH_NOT_FOUND"
    });
    await expect(
      createBranch(depsFor(), input({ simulateSnapshotFailure: true }))
    ).resolves.toEqual({
      branchName: "feature/refund",
      exitCode: 5,
      status: "SNAPSHOT_FAILED"
    });
  });

  test("suggests the next available branch name for collisions", async () => {
    const result = await createBranch(
      depsFor({
        existingBranches: [
          mainBranch(),
          mainBranch({ id: "branch-existing", name: "feature/refund" }),
          mainBranch({ id: "branch-existing-2", name: "feature/refund-2" })
        ]
      }),
      input()
    );

    expect(result).toEqual({
      status: "NAME_COLLISION",
      suggestedName: "feature/refund-3"
    });
  });

  test("falls back to current revisions and placeholder use case guidance", async () => {
    const result = await createBranch(
      depsFor({
        latestRevisionId: undefined,
        usecases: [usecase({ current_revision_id: "revision-current" })]
      }),
      input()
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected branch creation success");
    }
    expect(result.branch.base_revision_ids).toEqual({
      "usecase-1": "revision-current"
    });

    const emptyResult = await createBranch(depsFor({ usecases: [] }), input());
    expect(emptyResult.status).toBe("CREATED");
    if (emptyResult.status !== "CREATED") {
      throw new Error("expected branch creation success");
    }
    expect(emptyResult.suggestedNextActions[1]).toEqual({
      command: "vspec usecase edit <KEY>",
      reason: "Start editing a use case on the branch."
    });
  });
});
