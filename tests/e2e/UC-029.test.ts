import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type PullResponse = {
  cursor: string;
  files: Array<{ content: string; path: string; revision: string }>;
};
type PushResponse = {
  cache: { entries: Array<{ path: string; revision: string; status: string }> };
  results: Array<{ current_revision: string; path: string; status: string }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type HistoryResponse = { revisions: Array<{ revision: string; version_number: number }> };

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-029 - Sync local files with the server", () => {
  test("MAIN: pull canonical markdown and push a changed use case file", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Sync Main", "sync-main", "stub-sync-main");

    const pulled = await server.fetch(`/v1/projects/${setup.projectId}/sync/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ branch: "main" })
    });

    expect(pulled.status).toBe(200);
    const pull = (await pulled.json()) as PullResponse;
    expect(pull.cursor).toBe(usecase.current_revision_id);
    expect(pull.files).toHaveLength(1);
    expect(pull.files[0]).toMatchObject({
      path: `specs/${usecase.key}.md`,
      revision: usecase.current_revision_id
    });
    expect(pull.files[0]?.content).toContain(`revision: ${usecase.current_revision_id}`);
    expect(pull.files[0]?.content).toContain(`# ${usecase.title}`);

    const editedContent = pull.files[0]?.content.replace(
      "# Reviews a refund",
      "# Reviews a refund quickly"
    );
    const pushed = await server.fetch(`/v1/projects/${setup.projectId}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        branch: "main",
        files: [{
          base_revision: usecase.current_revision_id,
          content: editedContent,
          path: `specs/${usecase.key}.md`
        }]
      })
    });

    expect(pushed.status).toBe(200);
    const push = (await pushed.json()) as PushResponse;
    expect(push.results[0]).toMatchObject({
      path: `specs/${usecase.key}.md`,
      status: "OK"
    });
    const newRevision = push.results[0]?.current_revision ?? "";
    expect(newRevision).not.toBe(usecase.current_revision_id);
    expect(push.cache.entries).toContainEqual({
      path: `specs/${usecase.key}.md`,
      revision: newRevision,
      status: "SYNCED"
    });
    expect(push.suggested_next_actions).toContainEqual({
      command: "vspec pull",
      reason: "Refresh local files after successful push."
    });

    const history = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });
    const historyBody = (await history.json()) as HistoryResponse;
    expect(historyBody.revisions.map((revision) => revision.revision)).toEqual([
      newRevision,
      usecase.current_revision_id
    ]);
  });
});
