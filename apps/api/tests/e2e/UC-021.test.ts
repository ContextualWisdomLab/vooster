import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { openStructuralConflict, resolveMerge } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { createStepLock } from "../helpers/step-fixtures.js";
type MergeResolveResponse = {
  main_head_revision_ids: Record<string, string>;
  merge_request: {
    conflicts: unknown[];
    id: string;
    resolved_at: string;
    status: string;
  };
  new_revisions: Array<{ entity_id: string; id: string; snapshot: { title?: string } }>;
  source_branch: { id: string; status: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type MergeResolveProblem = {
  conflicts?: unknown[];
  current_revision?: string;
  exit_code?: number;
  field?: string;
  holding_session?: string;
  main_head_revision_ids?: Record<string, string>;
  merge_request?: { status: string };
  offending_entity_id?: string;
  source_branch?: { status: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
  uncovered_conflicts?: unknown[];
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-021 - Resolve a merge conflict", () => {
  test("MAIN: resolve structural conflict with source value", async () => {
    const { branch, merge, setup, usecase } = await openStructuralConflict(
      server,
      "Resolve Merge",
      "resolve-merge",
      "stub-resolve-merge",
      "feature/resolve-refund"
    );

    const response = await resolveMerge(server, setup, merge.id, {
      base_revision: merge.current_revision_id ?? "missing-current-revision",
      resolutions: [{ entity_id: usecase.id, field: "title", strategy: "THEIRS" }]
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as MergeResolveResponse;
    expect(body.merge_request).toMatchObject({
      conflicts: [],
      id: merge.id,
      status: "MERGED"
    });
    expect(Date.parse(body.merge_request.resolved_at)).not.toBeNaN();
    expect(body.source_branch).toMatchObject({ id: branch.id, status: "MERGED" });
    const newRevision = body.new_revisions.find(
      (revision) => revision.entity_id === usecase.id
    );
    expect(newRevision?.snapshot.title).toBe("Reviews a refund quickly");
    expect(body.main_head_revision_ids[usecase.id]).toBe(newRevision?.id);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key}`,
      reason: "Review the resolved use case on main."
    });
  });

  test("2a: stale base revision returns current merge conflicts", async () => {
    const { merge, setup, usecase } = await openStructuralConflict(
      server,
      "Stale Resolve",
      "stale-resolve",
      "stub-stale-resolve",
      "feature/stale-resolve"
    );

    const response = await resolveMerge(server, setup, merge.id, {
      base_revision: "stale-merge-revision",
      resolutions: [{ entity_id: usecase.id, field: "title", strategy: "THEIRS" }]
    });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as MergeResolveProblem;
    expect(problem.title).toMatch(/base revision is stale/i);
    expect(problem.current_revision).toBe(merge.current_revision_id);
    expect(problem.conflicts).toEqual(merge.conflicts);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec merge show ${merge.id}`,
      reason: "Reload the current conflict list before resolving."
    });
  });

  test("3a: manual resolution requires a value", async () => {
    const { merge, setup, usecase } = await openStructuralConflict(
      server,
      "Manual Resolve",
      "manual-resolve",
      "stub-manual-resolve",
      "feature/manual-resolve"
    );

    const response = await resolveMerge(server, setup, merge.id, {
      base_revision: merge.current_revision_id,
      resolutions: [{ entity_id: usecase.id, field: "title", strategy: "MANUAL" }]
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as MergeResolveProblem;
    expect(problem.title).toMatch(/manual.*value/i);
    expect(problem.offending_entity_id).toBe(usecase.id);
    expect(problem.field).toBe("title");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec merge show ${merge.id}`,
      reason: "Review the original conflict before resolving manually."
    });
  });

  test("3b: every conflict must have a resolution", async () => {
    const { merge, setup } = await openStructuralConflict(
      server,
      "Partial Resolve",
      "partial-resolve",
      "stub-partial-resolve",
      "feature/partial-resolve"
    );

    const response = await resolveMerge(server, setup, merge.id, {
      base_revision: merge.current_revision_id,
      resolutions: [{ entity_id: "other-usecase", field: "title", strategy: "THEIRS" }]
    });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as MergeResolveProblem;
    expect(problem.title).toMatch(/cover every conflict/i);
    expect(problem.uncovered_conflicts).toEqual(merge.conflicts);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec merge resolve ${merge.id} --all`,
      reason: "Submit one resolution for each outstanding conflict."
    });
  });

  test("5a: late hard lock blocks conflict resolution", async () => {
    const { mainRevision, merge, setup, usecase } = await openStructuralConflict(
      server,
      "Locked Resolve",
      "locked-resolve",
      "stub-locked-resolve",
      "feature/locked-resolve"
    );
    await createStepLock(server, usecase.id, setup.cookie, {
      expires_at: "2026-06-01T00:00:00.000Z",
      holder: "late-lock-holder",
      mode: "HARD",
      reason: "Lock acquired after MR opened."
    });

    const response = await resolveMerge(server, setup, merge.id, {
      base_revision: merge.current_revision_id,
      resolutions: [{ entity_id: usecase.id, field: "title", strategy: "THEIRS" }]
    });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as MergeResolveProblem;
    expect(problem.title).toMatch(/hard lock/i);
    expect(problem.holding_session).toBe("late-lock-holder");
    expect(problem.merge_request).toMatchObject({ status: "OPEN" });
    expect(problem.main_head_revision_ids?.[usecase.id]).toBe(mainRevision.revision_id);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Inspect the session holding the hard lock."
    });
  });

  test("*a: write failure leaves merge request open and main unchanged", async () => {
    const { mainRevision, merge, setup, usecase } = await openStructuralConflict(
      server,
      "Failed Resolve",
      "failed-resolve",
      "stub-failed-resolve",
      "feature/failed-resolve"
    );

    const response = await resolveMerge(server, setup, merge.id, {
      base_revision: merge.current_revision_id,
      resolutions: [{ entity_id: usecase.id, field: "title", strategy: "THEIRS" }],
      simulate_write_failure: true
    });

    expect(response.status).toBe(500);
    const problem = (await response.json()) as MergeResolveProblem;
    expect(problem.exit_code).toBe(5);
    expect(problem.merge_request).toMatchObject({ status: "OPEN" });
    expect(problem.source_branch).toMatchObject({ status: "ACTIVE" });
    expect(problem.main_head_revision_ids?.[usecase.id]).toBe(mainRevision.revision_id);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec merge resolve ${merge.id} --retry`,
      reason: "Retry after the failed conflict resolution."
    });
  });
});
