import { describe, expect, test } from "vitest";
import { completeSession } from "../../../src/application/session-completion.js";
import type { StoredMergeRequest } from "../../../src/domain/entities/index.js";
import type { StoredWorkSession } from "../../../src/domain/entities/index.js";
import { branch, lock, mergeRequest, session } from "./session-completion-data.js";
import { depsFor, input } from "./session-completion-fixtures.js";

describe("session completion application", () => {
  test("completes the session, releases locks, and opens a merge request", async () => {
    const deletedLocks: string[] = [];
    const savedMergeRequests: StoredMergeRequest[] = [];
    const updatedSessions: StoredWorkSession[] = [];

    const result = await completeSession(
      depsFor({ deletedLocks, savedMergeRequests, updatedSessions }),
      input()
    );

    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") {
      throw new Error("expected session completion success");
    }
    expect(result.session).toMatchObject({
      ended_at: "2026-05-20T01:00:00.000Z",
      id: "session-1",
      last_activity_at: "2026-05-20T01:00:00.000Z",
      status: "COMPLETED"
    });
    expect(result.releasedLockIds).toEqual(["lock-1"]);
    expect(deletedLocks).toEqual(["lock-1"]);
    expect(result.mergeRequest).toEqual(mergeRequest());
    expect(savedMergeRequests).toEqual([mergeRequest()]);
    expect(updatedSessions).toEqual([result.session]);
    expect(result.suggestedNextActions).toEqual([
      {
        command: "vspec merge show id-1",
        reason: "Review the merge request opened for this completed session."
      }
    ]);
  });

  test("rejects missing, unauthorized, inactive, and failed completions before writes", async () => {
    await expect(
      completeSession(depsFor({ session: undefined }), input())
    ).resolves.toEqual({ status: "SESSION_NOT_FOUND" });
    await expect(
      completeSession(depsFor(), input({ userId: "stranger" }))
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      completeSession(depsFor({ session: session({ status: "COMPLETED" }) }), input())
    ).resolves.toEqual({
      currentStatus: "COMPLETED",
      sessionId: "session-1",
      status: "SESSION_NOT_ACTIVE"
    });
    await expect(
      completeSession(depsFor(), input({ simulateCompletionFailure: true }))
    ).resolves.toEqual({ exitCode: 5, status: "COMPLETION_FAILED" });
  });

  test("supports workspace members, conflicts, no-merge guidance, and lock warnings", async () => {
    await expect(
      completeSession(depsFor(), input({ userId: "user-2" }))
    ).resolves.toMatchObject({ status: "COMPLETED" });

    const conflictResult = await completeSession(
      depsFor(),
      input({ simulateConflicts: true })
    );
    expect(conflictResult.status).toBe("COMPLETED");
    if (conflictResult.status !== "COMPLETED") {
      throw new Error("expected conflict completion success");
    }
    expect(conflictResult.mergeRequest?.conflicts).toEqual([
      { entity_id: "usecase-1", type: "SEMANTIC" }
    ]);
    expect(conflictResult.suggestedNextActions[0]?.command).toBe(
      "vspec merge resolve id-1"
    );

    const noMergeResult = await completeSession(
      depsFor({ branch: branch({ name: "agent/no-merge" }) }),
      input({ noMerge: true })
    );
    expect(noMergeResult.status).toBe("COMPLETED");
    if (noMergeResult.status !== "COMPLETED") {
      throw new Error("expected no-merge completion success");
    }
    expect(noMergeResult.mergeRequest).toBeUndefined();
    expect(noMergeResult.suggestedNextActions).toEqual([
      {
        command: "vspec merge open agent/no-merge",
        reason: "Open a merge request for the completed branch later."
      }
    ]);

    const warningResult = await completeSession(
      depsFor({ locks: [lock(), lock({ id: "lock-2", usecase_id: "usecase-2" })] }),
      input({ simulateFailedLockRelease: "usecase-2" })
    );
    expect(warningResult.status).toBe("COMPLETED");
    if (warningResult.status !== "COMPLETED") {
      throw new Error("expected warning completion success");
    }
    expect(warningResult.releasedLockIds).toEqual(["lock-1"]);
    expect(warningResult.warnings).toEqual([
      {
        lock_id: "lock-2",
        message: "Lock was already released before completion.",
        type: "LOCK_RELEASE_FAILED"
      }
    ]);
  });
});
