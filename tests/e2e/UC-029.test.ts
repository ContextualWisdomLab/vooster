import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type PullResponse = {
  cursor: string;
  files: Array<{ content: string; path: string; revision: string }>;
};
type PushResponse = {
  cache: { entries: Array<{ path: string; revision: string; status: string }> };
  results: Array<{
    conflict_content?: string;
    current_revision: string;
    impact?: { entity_id: string; severity: string };
    path: string;
    status: string;
  }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type HistoryResponse = { revisions: Array<{ revision: string; version_number: number }> };
type SyncProblem = {
  offending_files: Array<{ line: number; message: string; path: string }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

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

  test("3a: malformed push file returns doctor guidance without a revision", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Sync Parse", "sync-parse", "stub-sync-parse");

    const pushed = await server.fetch(`/v1/projects/${setup.projectId}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        branch: "main",
        files: [{
          base_revision: usecase.current_revision_id,
          content: "# Missing frontmatter",
          path: `specs/${usecase.key}.md`
        }]
      })
    });

    expect(pushed.status).toBe(400);
    const problem = (await pushed.json()) as SyncProblem;
    expect(problem.title).toMatch(/sync file parse failed/i);
    expect(problem.offending_files).toContainEqual({
      line: 1,
      message: "Missing frontmatter",
      path: `specs/${usecase.key}.md`
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec doctor specs/${usecase.key}.md`,
      reason: "Validate the local file before pushing."
    });

    const history = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });
    const historyBody = (await history.json()) as HistoryResponse;
    expect(historyBody.revisions.map((revision) => revision.revision)).toEqual([
      usecase.current_revision_id
    ]);
  });

  test("4a: stale base revision returns conflict details without overwriting", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Sync Conflict", "sync-conflict", "stub-sync-conflict");

    const pulled = await server.fetch(`/v1/projects/${setup.projectId}/sync/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ branch: "main" })
    });
    const pull = (await pulled.json()) as PullResponse;
    const path = `specs/${usecase.key}.md`;
    const originalContent = pull.files[0]?.content ?? "";

    const serverPush = await server.fetch(`/v1/projects/${setup.projectId}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        branch: "main",
        files: [{
          base_revision: usecase.current_revision_id,
          content: originalContent.replace("# Reviews a refund", "# Reviews a refund on server"),
          path
        }]
      })
    });
    const serverRevision = ((await serverPush.json()) as PushResponse)
      .results[0]?.current_revision ?? "";

    const stalePush = await server.fetch(`/v1/projects/${setup.projectId}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        branch: "main",
        files: [{
          base_revision: usecase.current_revision_id,
          content: originalContent.replace("# Reviews a refund", "# Reviews a refund locally"),
          path
        }]
      })
    });

    expect(stalePush.status).toBe(200);
    const conflict = (await stalePush.json()) as PushResponse;
    expect(conflict.results[0]).toMatchObject({
      current_revision: serverRevision,
      impact: { entity_id: usecase.id, severity: "BREAKING" },
      path,
      status: "CONFLICT"
    });
    expect(conflict.results[0]?.conflict_content).toContain("<<<<<<< local");
    expect(conflict.results[0]?.conflict_content).toContain("=======");
    expect(conflict.results[0]?.conflict_content).toContain(`>>>>>>> remote (${serverRevision}`);
    expect(conflict.cache.entries).toContainEqual({
      path,
      revision: serverRevision,
      status: "UNRESOLVED"
    });
    expect(conflict.suggested_next_actions).toContainEqual({
      command: "vspec diff",
      reason: "Inspect the server and local changes before resolving the conflict."
    });
    expect(conflict.suggested_next_actions).toContainEqual({
      command: "vspec push",
      reason: "Push again after removing conflict markers."
    });

    const history = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });
    const historyBody = (await history.json()) as HistoryResponse;
    expect(historyBody.revisions.map((revision) => revision.revision)).toEqual([
      serverRevision,
      usecase.current_revision_id
    ]);
  });
});
