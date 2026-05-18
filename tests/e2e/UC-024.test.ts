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
});
