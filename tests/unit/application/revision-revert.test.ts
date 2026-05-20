import { describe, expect, test } from "vitest";
import { revertUseCaseRevision } from "../../../src/application/revision-revert.js";
import type { StoredRevision, StoredUseCase } from "../../../src/http/signup-types.js";
import {
  depsFor,
  lock,
  revertInput,
  revisions,
  session,
  usecase
} from "./revision-revert-fixtures.js";

describe("revision revert application", () => {
  test("appends a forward revision and advances the default branch head", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedBranches: Array<{ head_revision_ids?: Record<string, string> }> = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await revertUseCaseRevision(
      depsFor({ savedRevisions, updatedBranches, updatedUseCases }),
      revertInput(),
      () => "revision-revert"
    );

    expect(result.status).toBe("REVERTED");
    if (result.status !== "REVERTED") {
      throw new Error("expected revert to succeed");
    }
    expect(result.revision).toMatchObject({
      change_summary: "Revert to revision-target",
      entity_id: "usecase-1",
      entity_type: "USECASE",
      id: "revision-revert",
      parent_revision_id: "revision-current",
      severity: "NON_BREAKING",
      snapshot: { title: "Reviews a refund" },
      version_number: 3
    });
    expect(result.usecase).toMatchObject({
      current_revision_id: "revision-revert",
      title: "Reviews a refund"
    });
    expect(result.impact).toEqual({
      affected_branches: [],
      affected_sessions: [],
      severity: "NON_BREAKING"
    });
    expect(result.suggestedNextActions).toContainEqual({
      command: "vspec history REV-001",
      reason: "Review the append-only revision history."
    });
    expect(savedRevisions).toEqual([result.revision]);
    expect(updatedUseCases).toEqual([result.usecase]);
    expect(updatedBranches[0]?.head_revision_ids).toMatchObject({
      "usecase-1": "revision-revert"
    });
  });

  test("rejects missing use cases and callers without membership before reading revisions", async () => {
    await expect(
      revertUseCaseRevision(depsFor({ usecase: null }), revertInput(), () => "unused")
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });

    await expect(
      revertUseCaseRevision(
        depsFor({ membership: null }),
        revertInput({ userId: "outsider" }),
        () => "unused"
      )
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });

  test("rejects hard locks without writing", async () => {
    const savedRevisions: StoredRevision[] = [];
    const hardLock = lock();

    await expect(
      revertUseCaseRevision(
        depsFor({ lock: hardLock, savedRevisions }),
        revertInput(),
        () => "unused"
      )
    ).resolves.toEqual({
      lock: hardLock,
      status: "HARD_LOCKED",
      usecase: usecase()
    });
    expect(savedRevisions).toEqual([]);
  });

  test("rejects missing target and current revisions without writing", async () => {
    const savedRevisions: StoredRevision[] = [];

    await expect(
      revertUseCaseRevision(
        depsFor({ revisions: revisions(), savedRevisions }),
        revertInput({ revisionId: "revision-missing" }),
        () => "unused"
      )
    ).resolves.toEqual({
      revisionId: "revision-missing",
      status: "TARGET_REVISION_NOT_FOUND",
      usecase: usecase()
    });

    await expect(
      revertUseCaseRevision(
        depsFor({ revisions: [], savedRevisions }),
        revertInput(),
        () => "unused"
      )
    ).resolves.toEqual({ status: "CURRENT_REVISION_NOT_FOUND" });
    expect(savedRevisions).toEqual([]);
  });

  test("rejects breaking reverts without force and reports active sessions", async () => {
    await expect(
      revertUseCaseRevision(
        depsFor({
          revisions: revisions({ current: { severity: "BREAKING" } }),
          sessions: [session(), session({ id: "session-done", status: "COMPLETED" })]
        }),
        revertInput(),
        () => "unused"
      )
    ).resolves.toEqual({
      affectedSessions: ["session-1"],
      currentRevision: expect.objectContaining({ id: "revision-current" }),
      status: "BREAKING_REVERT",
      targetRevisionId: "revision-target",
      usecase: usecase()
    });
  });

  test("reports write failures and optional Gherkin drift warnings", async () => {
    await expect(
      revertUseCaseRevision(
        depsFor(),
        revertInput({ simulateWriteFailure: true }),
        () => "unused"
      )
    ).resolves.toEqual({
      status: "WRITE_FAILED",
      targetRevisionId: "revision-target",
      usecase: usecase()
    });

    const result = await revertUseCaseRevision(
      depsFor(),
      revertInput({ force: true, simulateGherkinDrift: true }),
      () => "revision-revert"
    );

    expect(result).toMatchObject({
      status: "REVERTED",
      warnings: [
        {
          message: "Pinned CI feature files will drift on next sync.",
          type: "GHERKIN_DRIFT"
        }
      ]
    });
  });
});
