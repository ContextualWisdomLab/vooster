import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

type BranchCreateResponse = {
  branch: {
    base_branch_id: string;
    base_revision_ids: Record<string, string>;
    head_revision_ids: Record<string, string>;
    id: string;
    name: string;
    owner_id: string;
    owner_type: string;
    project_id: string;
    status: string;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type BranchProblemResponse = {
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

describe("UC-019 - Create a branch", () => {
  test("MAIN: create human branch from main with base revision snapshot", async () => {
    const setup = await createProject(server, "Branch Create", "branch-create", "stub-branch-create");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews a refund");

    const response = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ from: "main", name: "feature/refund-review" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as BranchCreateResponse;
    expect(body.branch).toMatchObject({
      base_revision_ids: { [usecase.id]: usecase.current_revision_id },
      head_revision_ids: { [usecase.id]: usecase.current_revision_id },
      name: "feature/refund-review",
      owner_id: setup.userId,
      owner_type: "HUMAN",
      project_id: setup.projectId,
      status: "ACTIVE"
    });
    expect(body.branch.base_branch_id).toEqual(expect.any(String));
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec branch checkout feature/refund-review",
      reason: "Switch to the isolated branch."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase edit ${usecase.key}`,
      reason: "Start editing a use case on the branch."
    });
  });

  test("3a: non-main base branch is rejected", async () => {
    const setup = await createProject(server, "Branch From Feature", "branch-from-feature", "stub-branch-from-feature");

    const response = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ from: "feature/existing", name: "feature/nested" })
    });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as BranchProblemResponse;
    expect(problem.title).toMatch(/single-level branches/i);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec branch create feature/nested --from main",
      reason: "Create MVP branches from main only."
    });
  });
});
