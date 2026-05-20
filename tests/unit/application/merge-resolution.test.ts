import { describe, expect, test } from "vitest";
import { resolveMerge } from "../../../src/application/merge-resolution.js";
import type { StoredMergeRequest } from "../../../src/http/merge-request-types.js";
import type {
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/http/signup-types.js";
import { featureBranch, lock, mergeRequest } from "./merge-resolution-data.js";
import { depsFor, input } from "./merge-resolution-fixtures.js";

describe("merge resolution application", () => {
  test("resolves every conflict and merges the source branch", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedBranches: StoredSpecBranch[] = [];
    const updatedMergeRequests: StoredMergeRequest[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await resolveMerge(
      depsFor({
        savedRevisions,
        updatedBranches,
        updatedMergeRequests,
        updatedUseCases
      }),
      input()
    );

    expect(result.status).toBe("MERGED");
    if (result.status !== "MERGED") {
      throw new Error("expected merge resolution success");
    }
    expect(result.mergeRequest).toMatchObject({
      conflicts: [],
      id: "merge-1",
      resolved_at: "2026-05-20T00:00:00.000Z",
      status: "MERGED"
    });
    expect(result.sourceBranch).toMatchObject({
      id: "branch-feature",
      merged_at: "2026-05-20T00:00:00.000Z",
      status: "MERGED"
    });
    expect(result.newRevisions).toMatchObject([
      {
        entity_id: "usecase-1",
        id: "id-1",
        snapshot: { title: "Source title" },
        version_number: 7
      }
    ]);
    expect(result.mainHeadRevisionIds).toEqual({ "usecase-1": "id-1" });
    expect(result.suggestedNextActions).toEqual([
      {
        command: "vspec usecase show MRG-001",
        reason: "Review the resolved use case on main."
      }
    ]);
    expect(savedRevisions.map((revision) => revision.id)).toEqual(["id-1"]);
    expect(updatedUseCases[0]?.current_revision_id).toBe("id-1");
    expect(updatedBranches.map((branch) => branch.id)).toEqual([
      "branch-main",
      "branch-feature"
    ]);
    expect(updatedMergeRequests).toEqual([result.mergeRequest]);
  });

  test("rejects invalid resolution requests before writes", async () => {
    await expect(
      resolveMerge(depsFor(), input({ baseRevision: "stale" }))
    ).resolves.toMatchObject({ mergeRequest: mergeRequest(), status: "STALE_BASE" });

    await expect(
      resolveMerge(
        depsFor(),
        input({
          resolutions: [{ entity_id: "usecase-1", field: "title", strategy: "MANUAL" }]
        })
      )
    ).resolves.toMatchObject({
      mergeRequest: mergeRequest(),
      resolution: { entity_id: "usecase-1", field: "title" },
      status: "MISSING_MANUAL_VALUE"
    });

    await expect(
      resolveMerge(
        depsFor(),
        input({
          resolutions: [
            { entity_id: "other-usecase", field: "title", strategy: "THEIRS" }
          ]
        })
      )
    ).resolves.toMatchObject({
      mergeRequest: mergeRequest(),
      status: "UNCOVERED_CONFLICTS",
      uncovered: mergeRequest().conflicts
    });
  });

  test("keeps the merge open for hard locks and simulated write failures", async () => {
    await expect(
      resolveMerge(depsFor({ hardLock: lock() }), input())
    ).resolves.toMatchObject({
      holdingSession: "session-lock-holder",
      mainHeadRevisionIds: { "usecase-1": "revision-main" },
      mergeRequest: mergeRequest(),
      status: "HARD_LOCK",
      useCaseKey: "MRG-001"
    });

    await expect(
      resolveMerge(depsFor(), input({ simulateWriteFailure: true }))
    ).resolves.toMatchObject({
      exitCode: 5,
      mainHeadRevisionIds: { "usecase-1": "revision-main" },
      mergeRequest: mergeRequest(),
      sourceBranch: featureBranch(),
      status: "WRITE_FAILED"
    });
  });
});
