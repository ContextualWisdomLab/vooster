import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { advanceMain, projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type ImpactResponse = {
  cached: boolean;
  impact: {
    affected_branches: string[];
    affected_sessions: unknown[];
    affected_tests: string[];
    confidence: number;
    input_hash: string;
    severity: string;
  };
  preview_id: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type HistoryResponse = { revisions: Array<{ revision: string }> };
type ImpactProblem = {
  parser_error?: string;
  path?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-027 - Analyze the impact of a proposed change", () => {
  test("MAIN: preview current head impact without writing revisions", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Impact Main", "impact-main", "stub-impact-main");
    const baseRevision = usecase.current_revision_id;
    const current = await advanceMain(server, setup, usecase.id, "Reviews a refund manually");

    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: current.revision_id,
        entity_id: usecase.id,
        entity_type: "USECASE"
      })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ImpactResponse;
    expect(body.cached).toBe(false);
    expect(body.preview_id).toEqual(expect.any(String));
    expect(body.impact).toMatchObject({
      affected_branches: [],
      affected_sessions: [],
      affected_tests: [],
      confidence: 1,
      severity: "BREAKING"
    });
    expect(body.impact.input_hash).toEqual(expect.any(String));
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec lock ${usecase.key}`,
      reason: "Lock the use case before applying a risky change."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec session list --status=active",
      reason: "Coordinate with affected active sessions."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec changes commit ${body.preview_id}`,
      reason: "Commit the previewed change after review."
    });

    const history = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });
    const historyBody = (await history.json()) as HistoryResponse;
    expect(historyBody.revisions.map((revision) => revision.revision)).toEqual([
      current.revision_id,
      baseRevision
    ]);
  });

  test("3a: missing proposed-change path returns guidance", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Impact Missing", "impact-missing", "stub-impact-missing");

    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: usecase.current_revision_id,
        entity_id: usecase.id,
        entity_type: "USECASE",
        proposed_change_path: "missing/usecase.md"
      })
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as ImpactProblem;
    expect(problem.title).toMatch(/proposed change file/i);
    expect(problem.path).toBe("missing/usecase.md");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec impact --proposed-change <path>",
      reason: "Verify the proposed-change path and retry."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec impact ${usecase.key}`,
      reason: "Rerun without a proposed-change file to analyze the current head."
    });
  });

  test("3b: malformed proposed-change content returns doctor guidance", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Impact Parse", "impact-parse", "stub-impact-parse");

    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        base_revision: usecase.current_revision_id,
        entity_id: usecase.id,
        entity_type: "USECASE",
        proposed_change_content: "# Missing frontmatter",
        proposed_change_path: "bad/usecase.md"
      })
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as ImpactProblem;
    expect(problem.title).toMatch(/proposed change parse failed/i);
    expect(problem.parser_error).toBe("Missing frontmatter");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec doctor bad/usecase.md",
      reason: "Validate the proposed-change file format."
    });
  });
});
