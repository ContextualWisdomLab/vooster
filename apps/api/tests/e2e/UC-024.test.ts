import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createUseCaseWithMainStep } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type HistoryResponse = {
  limit: number;
  revisions: Array<{
    author: string;
    change_summary?: string;
    entity_id: string;
    entity_type: string;
    revision: string;
    timestamp: string;
    version_number: number;
  }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  suppressed_count: number;
  truncated: boolean;
  usecase: { id: string; key: string };
};
type HistoryProblem = {
  exit_code?: number;
  history?: unknown;
  project_key?: string;
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

describe("UC-024 - View use case revision history", () => {
  test("MAIN: list newest-first revision history for a use case", async () => {
    const { mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(server, "History Main", "history-main", "stub-history-main");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as HistoryResponse;
    expect(body.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(body.limit).toBe(50);
    expect(body.truncated).toBe(false);
    expect(body.suppressed_count).toBe(0);
    expect(body.revisions.map((revision) => revision.version_number)).toEqual([4, 3, 2, 1]);
    expect(body.revisions[0]).toMatchObject({
      author: setup.userId,
      change_summary: "Added step 1 to main success scenario",
      entity_id: usecase.id,
      entity_type: "USECASE",
      revision: mainStepRevision.id,
      version_number: 4
    });
    expect(Date.parse(body.revisions[0]?.timestamp ?? "")).not.toBeNaN();
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key} --revision=${mainStepRevision.id}`,
      reason: "Inspect the selected revision."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec diff",
      reason: "Compare two revisions before reverting."
    });
  });

  test("2a: missing use case returns project-scoped list guidance", async () => {
    const { setup } =
      await createUseCaseWithMainStep(server, "History Missing", "history-missing", "stub-history-missing");

    const response = await server.fetch(`/v1/usecases/CHK-999/revisions?project_id=${setup.projectId}`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(404);
    const problem = (await response.json()) as HistoryProblem;
    expect(problem.title).toMatch(/use case not found/i);
    expect(problem.project_key).toBe("CHK");
    expect(problem.history).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec usecase list --project CHK",
      reason: "Find a use case in the current project."
    });
  });

  test("2b: non-member cannot view revision history", async () => {
    const mine = await createUseCaseWithMainStep(server, "History Mine", "history-mine", "stub-history-mine");
    const other = await createUseCaseWithMainStep(server, "History Other", "history-other", "stub-history-other");

    const response = await server.fetch(`/v1/usecases/${other.usecase.id}/revisions`, {
      headers: { Cookie: mine.setup.cookie }
    });

    expect(response.status).toBe(403);
    const problem = (await response.json()) as HistoryProblem;
    expect(problem.title).toMatch(/not authorized/i);
    expect(problem.history).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Authenticate with an account that has project access."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member set-role",
      reason: "Ask a workspace owner for read access."
    });
  });

  test("5a: limit truncates history with suppressed row guidance", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "History Limit", "history-limit", "stub-history-limit");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/revisions?limit=2`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as HistoryResponse;
    expect(body.revisions).toHaveLength(2);
    expect(body.truncated).toBe(true);
    expect(body.suppressed_count).toBe(2);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key} --limit 4`,
      reason: "Rerun with a larger limit to include suppressed rows."
    });
  });

  test("*a: history read failure returns retry guidance without mutation", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "History Failure", "history-failure", "stub-history-failure");

    const failed = await server.fetch(
      `/v1/usecases/${usecase.id}/revisions?simulate_server_error=true`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(failed.status).toBe(500);
    const problem = (await failed.json()) as HistoryProblem;
    expect(problem.exit_code).toBe(5);
    expect(problem.history).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key} --retry`,
      reason: "Retry the history request."
    });

    const retry = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });
    expect(retry.status).toBe(200);
    const body = (await retry.json()) as HistoryResponse;
    expect(body.revisions.map((revision) => revision.version_number)).toEqual([4, 3, 2, 1]);
  });
});
