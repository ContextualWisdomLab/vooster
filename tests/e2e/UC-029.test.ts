import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  expectDryRunSyncPush,
  expectHistoryRevisions,
  expectNetworkFailureSyncPush,
  expectUnauthorizedSyncPush,
  pulledSyncFile,
  syncPull,
  syncPush,
  type PullResponse,
  type PushResponse,
  type SyncProblem
} from "../helpers/sync-fixtures.js";

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-029 - Sync local files with the server", () => {
  test("MAIN: pull canonical markdown and push a changed use case file", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Sync Main", "sync-main", "stub-sync-main");

    const pulled = await syncPull(server, setup);
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
    const pushed = await syncPush(server, setup, {
      base_revision: usecase.current_revision_id,
      content: editedContent,
      path: `specs/${usecase.key}.md`
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

    await expectHistoryRevisions(server, setup.cookie, usecase.id, [
      newRevision,
      usecase.current_revision_id
    ]);
  });

  test("3a: malformed push file returns doctor guidance without a revision", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Sync Parse", "sync-parse", "stub-sync-parse");
    const pushed = await syncPush(server, setup, {
      base_revision: usecase.current_revision_id,
      content: "# Missing frontmatter",
      path: `specs/${usecase.key}.md`
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

    await expectHistoryRevisions(server, setup.cookie, usecase.id, [
      usecase.current_revision_id
    ]);
  });

  test("4a: stale base revision returns conflict details without overwriting", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Sync Conflict", "sync-conflict", "stub-sync-conflict");
    const { content: originalContent, path } =
      await pulledSyncFile(server, setup, usecase.key);

    const serverPush = await syncPush(server, setup, {
      base_revision: usecase.current_revision_id,
      content: originalContent.replace("# Reviews a refund", "# Reviews a refund on server"),
      path
    });
    const serverRevision = ((await serverPush.json()) as PushResponse)
      .results[0]?.current_revision ?? "";

    const stalePush = await syncPush(server, setup, {
      base_revision: usecase.current_revision_id,
      content: originalContent.replace("# Reviews a refund", "# Reviews a refund locally"),
      path
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

    await expectHistoryRevisions(server, setup.cookie, usecase.id, [
      serverRevision,
      usecase.current_revision_id
    ]);
  });

  test("1a: dry-run push reports outcome without revision or cache update", async () => {
    await expectDryRunSyncPush(server);
  });

  test("4b: simulated network failure queues pending push metadata", async () => {
    await expectNetworkFailureSyncPush(server);
  });

  test("*a: unauthorized sync push returns login and API-key guidance", async () => {
    await expectUnauthorizedSyncPush(server);
  });
});
