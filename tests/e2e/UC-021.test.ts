import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  advanceBranch,
  advanceMain,
  createBranch,
  openMerge,
  projectUseCase,
  type MergeOpenResponse
} from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

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
  field?: string;
  offending_entity_id?: string;
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
    const { setup, usecase } = await projectUseCase(server, "Resolve Merge", "resolve-merge", "stub-resolve-merge");
    const branch = await createBranch(server, setup, "feature/resolve-refund");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const opened = await openMerge(server, setup, branch.id);
    const merge = ((await opened.json()) as MergeOpenResponse).merge_request;

    const response = await server.fetch(`/v1/merges/${merge.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: merge.current_revision_id ?? "missing-current-revision",
        resolutions: [{ entity_id: usecase.id, field: "title", strategy: "THEIRS" }]
      })
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
    const newRevision = body.new_revisions.find((revision) => revision.entity_id === usecase.id);
    expect(newRevision?.snapshot.title).toBe("Reviews a refund quickly");
    expect(body.main_head_revision_ids[usecase.id]).toBe(newRevision?.id);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key}`,
      reason: "Review the resolved use case on main."
    });
  });

  test("2a: stale base revision returns current merge conflicts", async () => {
    const { setup, usecase } = await projectUseCase(server, "Stale Resolve", "stale-resolve", "stub-stale-resolve");
    const branch = await createBranch(server, setup, "feature/stale-resolve");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const opened = await openMerge(server, setup, branch.id);
    const merge = ((await opened.json()) as MergeOpenResponse).merge_request;

    const response = await server.fetch(`/v1/merges/${merge.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: "stale-merge-revision",
        resolutions: [{ entity_id: usecase.id, field: "title", strategy: "THEIRS" }]
      })
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
    const { setup, usecase } = await projectUseCase(server, "Manual Resolve", "manual-resolve", "stub-manual-resolve");
    const branch = await createBranch(server, setup, "feature/manual-resolve");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const opened = await openMerge(server, setup, branch.id);
    const merge = ((await opened.json()) as MergeOpenResponse).merge_request;

    const response = await server.fetch(`/v1/merges/${merge.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: merge.current_revision_id,
        resolutions: [{ entity_id: usecase.id, field: "title", strategy: "MANUAL" }]
      })
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
    const { setup, usecase } = await projectUseCase(server, "Partial Resolve", "partial-resolve", "stub-partial-resolve");
    const branch = await createBranch(server, setup, "feature/partial-resolve");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const opened = await openMerge(server, setup, branch.id);
    const merge = ((await opened.json()) as MergeOpenResponse).merge_request;

    const response = await server.fetch(`/v1/merges/${merge.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: merge.current_revision_id,
        resolutions: [{ entity_id: "other-usecase", field: "title", strategy: "THEIRS" }]
      })
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
});
