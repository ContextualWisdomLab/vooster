import { describe, expect, test } from "vitest";
import {
  archiveUseCase,
  restoreUseCase
} from "../../../src/application/usecase-archive.js";
import type {
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { hardLock, session, usecase } from "./usecase-archive-data.js";
import { depsFor, input } from "./usecase-archive-fixtures.js";

describe("use case archive application", () => {
  test("archives a use case, writes a revision, advances main, and reports active work", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedBranches: StoredSpecBranch[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await archiveUseCase(
      depsFor({
        locks: [hardLock({ expires_at: "2026-05-20T00:30:00.000Z", mode: "SOFT" })],
        savedRevisions,
        sessions: [session()],
        updatedBranches,
        updatedUseCases
      }),
      input()
    );

    expect(result.status).toBe("ARCHIVED");
    if (result.status !== "ARCHIVED") {
      throw new Error("expected archive success");
    }
    expect(result.usecase).toEqual({
      archived_at: "2026-05-20T00:00:00.000Z",
      id: "usecase-1",
      key: "ARC-001"
    });
    expect(result.revision).toEqual({
      change_summary: "Archived use case ARC-001",
      id: "id-1"
    });
    expect(result.affectedSessions).toEqual([
      { id: "session-1", pinned_revision: "revision-current" }
    ]);
    expect(result.activeLocksCount).toBe(1);
    expect(savedRevisions[0]).toMatchObject({
      entity_id: "usecase-1",
      id: "id-1",
      version_number: 2
    });
    expect(updatedUseCases[0]?.current_revision_id).toBe("id-1");
    expect(updatedBranches[0]?.head_revision_ids).toEqual({ "usecase-1": "id-1" });
  });

  test("rejects missing, unauthorized, hard-delete, archived, and hard-locked archive requests", async () => {
    await expect(
      archiveUseCase(depsFor({ usecase: undefined }), input())
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });
    await expect(
      archiveUseCase(depsFor(), input({ userId: "stranger" }))
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      archiveUseCase(depsFor(), input({ hardDeleteRequested: true }))
    ).resolves.toMatchObject({ status: "HARD_DELETE_REQUESTED", usecase: usecase() });
    await expect(
      archiveUseCase(
        depsFor({ usecase: usecase({ archived_at: "2026-05-19T00:00:00.000Z" }) }),
        input()
      )
    ).resolves.toMatchObject({ status: "ALREADY_ARCHIVED" });
    await expect(
      archiveUseCase(depsFor({ locks: [hardLock()] }), input())
    ).resolves.toMatchObject({
      expiresAt: "2026-05-20T01:00:00.000Z",
      holdingSession: "session-lock",
      status: "HARD_LOCKED"
    });
  });

  test("restores an archived use case and advances main", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedBranches: StoredSpecBranch[] = [];

    const result = await restoreUseCase(
      depsFor({
        savedRevisions,
        updatedBranches,
        usecase: usecase({ archived_at: "2026-05-19T00:00:00.000Z" })
      }),
      input()
    );

    expect(result.status).toBe("RESTORED");
    if (result.status !== "RESTORED") {
      throw new Error("expected restore success");
    }
    expect(result.usecase).toEqual({
      archived_at: null,
      id: "usecase-1",
      key: "ARC-001"
    });
    expect(result.revision).toEqual({
      change_summary: "Restored use case ARC-001",
      id: "id-1"
    });
    expect(savedRevisions[0]?.snapshot).toMatchObject({ archived_at: null });
    expect(updatedBranches[0]?.head_revision_ids).toEqual({ "usecase-1": "id-1" });
    await expect(restoreUseCase(depsFor(), input())).resolves.toEqual({
      status: "NOT_ARCHIVED"
    });
  });
});
