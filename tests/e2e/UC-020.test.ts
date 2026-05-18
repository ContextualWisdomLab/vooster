import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  advanceBranch,
  advanceMain,
  createBranch,
  openMerge,
  projectUseCase,
  type MergeOpenResponse,
  type MergeProblemResponse
} from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { createStepLock } from "../helpers/step-fixtures.js";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-020 - Merge a branch", () => {
  test("MAIN: clean branch merge fast-forwards main", async () => {
    const { setup, usecase } = await projectUseCase(server, "Merge Branch", "merge-branch", "stub-merge-branch");
    const branch = await createBranch(server, setup, "feature/merge-refund");
    const branchRevision = await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly", "NON_BREAKING");
    const response = await openMerge(server, setup, branch.id);

    expect(response.status).toBe(201);
    const body = (await response.json()) as MergeOpenResponse;
    expect(body.merge_request).toMatchObject({
      conflicts: [],
      source_branch_id: branch.id,
      status: "MERGED",
      strategy: "FAST_FORWARD",
      target_branch_id: branch.base_branch_id
    });
    expect(body.merge_request.impact).toEqual({
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: { [usecase.id]: "NON_BREAKING" }
    });
    expect(body.main_head_revision_ids[usecase.id]).toBe(branchRevision.revision_id);
    expect(body.source_branch).toMatchObject({ id: branch.id, status: "MERGED" });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec merge show ${body.merge_request.id}`,
      reason: "Review the completed merge request."
    });
  });

  test("4a: structural conflict leaves merge request open", async () => {
    const { setup, usecase } = await projectUseCase(server, "Structural Merge", "structural-merge", "stub-structural-merge");
    const branch = await createBranch(server, setup, "feature/structural-conflict");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    const mainRevision = await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const response = await openMerge(server, setup, branch.id);

    expect(response.status).toBe(201);
    const body = (await response.json()) as MergeOpenResponse;
    expect(body.merge_request).toMatchObject({
      source_branch_id: branch.id,
      status: "OPEN",
      strategy: "SQUASH"
    });
    expect(body.merge_request.conflicts).toContainEqual({
      entity_id: usecase.id,
      entity_type: "USECASE",
      field: "title",
      mine_value: "Reviews a refund quickly",
      theirs_value: "Reviews a refund manually",
      type: "STRUCTURAL"
    });
    expect(body.main_head_revision_ids[usecase.id]).toBe(mainRevision.revision_id);
    expect(body.source_branch).toMatchObject({ id: branch.id, status: "ACTIVE" });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec merge resolve ${body.merge_request.id}`,
      reason: "Resolve conflicts before this branch can merge."
    });
  });

  test("4b: hard lock blocks merge and keeps merge request open", async () => {
    const { setup, usecase } = await projectUseCase(server, "Locked Merge", "locked-merge", "stub-locked-merge");
    const branch = await createBranch(server, setup, "feature/locked-merge");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund with audit");
    await createStepLock(server, usecase.id, setup.cookie, {
      expires_at: "2026-06-01T00:00:00.000Z",
      holder: "session-lock-holder",
      mode: "HARD",
      reason: "Another session owns the target."
    });

    const response = await openMerge(server, setup, branch.id);

    expect(response.status).toBe(409);
    const problem = (await response.json()) as MergeProblemResponse;
    expect(problem.title).toMatch(/hard lock/i);
    expect(problem.holding_session).toBe("session-lock-holder");
    expect(problem.merge_request).toMatchObject({ status: "OPEN" });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Inspect the session holding the hard lock."
    });
  });
});
