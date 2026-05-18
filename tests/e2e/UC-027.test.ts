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
    expect(body.impact).toEqual({
      affected_branches: [],
      affected_sessions: [],
      affected_tests: [],
      confidence: 1,
      input_hash: expect.any(String),
      severity: "BREAKING"
    });
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
});
