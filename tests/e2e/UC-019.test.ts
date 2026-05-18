import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  completeWorkSession,
  startWorkSession,
  type SessionCompleteResponse,
  type SessionStartResponse
} from "../helpers/session-fixtures.js";
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
  warnings?: Array<{ merge_request_id: string; type: string }>;
};
type BranchProblemResponse = {
  suggested_name?: string;
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

  test("2a: read-only member cannot create a branch", async () => {
    const setup = await createProject(server, "Branch Read Only", "branch-read-only", "stub-branch-readonly");
    await server.fetch(
      `/__test/workspaces/${setup.workspaceId}/members/${setup.userId}/read-only`,
      { method: "POST" }
    );

    const response = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/read-only" })
    });

    expect(response.status).toBe(403);
    const problem = (await response.json()) as BranchProblemResponse;
    expect(problem.title).toMatch(/editor role required/i);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member list",
      reason: "Find a workspace editor or owner who can create branches."
    });
  });

  test("5a: branch name collision suggests an alternative", async () => {
    const setup = await createProject(server, "Branch Collision", "branch-collision", "stub-branch-collision");
    await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/collide" })
    });

    const response = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/collide" })
    });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as BranchProblemResponse;
    expect(problem.title).toMatch(/branch name is already in use/i);
    expect(problem.suggested_name).toBe("feature/collide-2");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec branch create feature/collide-2",
      reason: "Create the branch with an available name."
    });
  });

  test("4a: branch creation warns about in-flight merge requests", async () => {
    const setup = await createProject(server, "Branch Warning", "branch-warning", "stub-branch-warning");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews a refund");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/branch-warning",
      intent: "Prepare an in-flight merge request",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const completed = await completeWorkSession(server, session.id, setup.cookie, {
      summary: "Open merge request."
    });
    const mergeRequest = ((await completed.json()) as SessionCompleteResponse).merge_request;
    if (mergeRequest === undefined) {
      throw new Error("expected merge request");
    }

    const response = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "feature/warn-about-merge" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as BranchCreateResponse;
    expect(body.branch.name).toBe("feature/warn-about-merge");
    expect(body.warnings).toContainEqual({
      merge_request_id: mergeRequest.id,
      type: "IN_FLIGHT_MERGE_REQUEST"
    });
  });
});
