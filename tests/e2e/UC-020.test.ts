import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { createStepLock } from "../helpers/step-fixtures.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

type BranchCreateResponse = {
  branch: {
    base_branch_id: string;
    id: string;
    name: string;
  };
};
type BranchRevisionResponse = { revision_id: string };
type MergeOpenResponse = {
  main_head_revision_ids: Record<string, string>;
  merge_request: {
    conflicts: unknown[];
    id: string;
    impact: {
      affected_branches: string[];
      affected_sessions: string[];
      severity_by_entity: Record<string, string>;
    };
    source_branch_id: string;
    status: string;
    strategy: string;
    target_branch_id: string;
  };
  source_branch: { id: string; status: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type MergeProblemResponse = {
  holding_session?: string;
  merge_request?: { status: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-020 - Merge a branch", () => {
  test("MAIN: clean branch merge fast-forwards main", async () => {
    const setup = await createProject(server, "Merge Branch", "merge-branch", "stub-merge-branch");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews a refund");
    const createdBranch = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/merge-refund" })
    });
    const branch = ((await createdBranch.json()) as BranchCreateResponse).branch;
    const advanced = await server.fetch(
      `/__test/branches/${branch.id}/usecases/${usecase.id}/revisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({ severity: "NON_BREAKING", title: "Reviews a refund quickly" })
      }
    );
    expect(advanced.status).toBe(200);
    const branchRevision = (await advanced.json()) as BranchRevisionResponse;

    const response = await server.fetch("/v1/merges", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ source_branch_id: branch.id, target: "main" })
    });

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
    const setup = await createProject(server, "Structural Merge", "structural-merge", "stub-structural-merge");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews a refund");
    const createdBranch = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/structural-conflict" })
    });
    const branch = ((await createdBranch.json()) as BranchCreateResponse).branch;
    await server.fetch(`/__test/branches/${branch.id}/usecases/${usecase.id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ severity: "BREAKING", title: "Reviews a refund quickly" })
    });
    const mainAdvanced = await server.fetch(`/__test/usecases/${usecase.id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ severity: "BREAKING", title: "Reviews a refund manually" })
    });
    expect(mainAdvanced.status).toBe(200);
    const mainRevision = (await mainAdvanced.json()) as BranchRevisionResponse;

    const response = await server.fetch("/v1/merges", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ source_branch_id: branch.id, target: "main" })
    });

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
    const setup = await createProject(server, "Locked Merge", "locked-merge", "stub-locked-merge");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews a refund");
    const createdBranch = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/locked-merge" })
    });
    const branch = ((await createdBranch.json()) as BranchCreateResponse).branch;
    await server.fetch(`/__test/branches/${branch.id}/usecases/${usecase.id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ severity: "BREAKING", title: "Reviews a refund with audit" })
    });
    await createStepLock(server, usecase.id, setup.cookie, {
      expires_at: "2026-06-01T00:00:00.000Z",
      holder: "session-lock-holder",
      mode: "HARD",
      reason: "Another session owns the target."
    });

    const response = await server.fetch("/v1/merges", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ source_branch_id: branch.id, target: "main" })
    });

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
