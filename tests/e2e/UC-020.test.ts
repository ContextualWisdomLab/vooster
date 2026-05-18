import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
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
});
