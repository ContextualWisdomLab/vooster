import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type ChangePreviewResponse = {
  diff: Array<{
    after: string;
    before: string;
    entity_id: string;
    entity_type: string;
    path: string;
    severity: string;
  }>;
  expires_at: string;
  impact: { affected_sessions: unknown[]; severity: string };
  preview_id: string;
  severity: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: unknown[];
};
type HistoryResponse = { revisions: Array<{ revision: string }> };

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-035 - Propose a spec change (AI agent)", () => {
  test("MAIN: propose a title change preview without writing a revision", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Change Preview", "change-preview", "stub-change-preview");

    const response = await proposeChange(setup.cookie, {
      base_revision: usecase.current_revision_id,
      patch: {
        entity_id: usecase.id,
        entity_type: "USECASE",
        fields: { title: "Reviews a refund with audit trail" }
      },
      usecase_key: usecase.key
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ChangePreviewResponse;
    expect(body.preview_id).toEqual(expect.any(String));
    expect(body.severity).toBe("NON_BREAKING");
    expect(body.impact).toMatchObject({ affected_sessions: [], severity: "NON_BREAKING" });
    expect(Date.parse(body.expires_at)).toBeGreaterThan(Date.now());
    expect(Date.parse(body.expires_at)).toBeLessThanOrEqual(Date.now() + 16 * 60_000);
    expect(body.diff).toEqual([
      {
        after: "Reviews a refund with audit trail",
        before: "Reviews a refund",
        entity_id: usecase.id,
        entity_type: "USECASE",
        path: "title",
        severity: "NON_BREAKING"
      }
    ]);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec change commit --preview-id ${body.preview_id}`,
      reason: "Commit the preview after human review."
    });
    expect(body.warnings).toEqual([]);
    expect(await historyRevisionIds(usecase.id, setup.cookie)).toEqual([
      usecase.current_revision_id
    ]);
  });
});

function proposeChange(cookie: string, body: Record<string, unknown>) {
  return server.fetch("/v1/changes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}

async function historyRevisionIds(usecaseId: string, cookie: string) {
  const history = await server.fetch(`/v1/usecases/${usecaseId}/revisions`, {
    headers: { Cookie: cookie }
  });
  const body = (await history.json()) as HistoryResponse;
  return body.revisions.map((revision) => revision.revision);
}
