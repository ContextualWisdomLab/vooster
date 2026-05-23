import { describe, expect, test } from "vitest";
import { resolveMerge } from "../../../src/application/merge-resolution.js";
import {
  featureBranch,
  lock,
  mainBranch,
  mergeRequest
} from "./merge-resolution-data.js";
import { depsFor, input } from "./merge-resolution-fixtures.js";

describe("merge resolution edge cases", () => {
  test("rejects missing merge data before checking conflicts", async () => {
    await expect(resolveMerge(depsFor({ merge: undefined }), input())).resolves.toEqual(
      { status: "MERGE_NOT_FOUND" }
    );

    await expect(
      resolveMerge(
        depsFor({
          merge: mergeRequest({ target_branch_id: null as unknown as string })
        }),
        input()
      )
    ).resolves.toEqual({ status: "BRANCH_NOT_FOUND" });
  });

  test("rejects unauthorized and already closed conflict requests", async () => {
    await expect(
      resolveMerge(depsFor(), input({ userId: undefined }))
    ).resolves.toEqual({ status: "ACCESS_DENIED" });

    const closed = mergeRequest({ conflicts: [], status: "MERGED" });
    await expect(resolveMerge(depsFor({ merge: closed }), input())).resolves.toEqual({
      mergeRequest: closed,
      status: "NO_OPEN_CONFLICTS"
    });
  });

  test("falls back to empty main head revisions when blocking resolution", async () => {
    await expect(
      resolveMerge(
        depsFor({
          hardLock: lock(),
          targetBranch: mainBranch({ head_revision_ids: undefined })
        }),
        input()
      )
    ).resolves.toMatchObject({
      mainHeadRevisionIds: {},
      status: "HARD_LOCK"
    });

    await expect(
      resolveMerge(
        depsFor({
          sourceBranch: featureBranch({ head_revision_ids: undefined }),
          targetBranch: mainBranch({ head_revision_ids: undefined })
        }),
        input({ simulateWriteFailure: true })
      )
    ).resolves.toMatchObject({
      mainHeadRevisionIds: {},
      status: "WRITE_FAILED"
    });
  });
});
