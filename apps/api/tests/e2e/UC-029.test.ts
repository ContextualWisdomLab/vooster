import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  expectDryRunSyncPush,
  expectHistoryRevisions,
  historyRevisions,
  expectNetworkFailureSyncPush,
  expectUnauthorizedSyncPush,
  syncPull,
  syncPush,
  type PullResponse,
  type PushResponse,
  type SyncProblem
} from "../helpers/sync-fixtures.js";
import {
  addStep,
  createExtensionScenario,
  createUseCaseWithMainStep,
  type ScenarioResponse,
  type StepResponse
} from "../helpers/scenario-fixtures.js";
import { patchStep, type StepPatchResponse } from "../helpers/step-fixtures.js";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.stop();
});

describe("UC-029 - Sync local files with the server", () => {
  test("MAIN: pull canonical markdown and push a changed use case file", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Sync Main",
      "sync-main",
      "stub-sync-main"
    );

    const pulled = await syncPull(server, setup);
    expect(pulled.status).toBe(200);
    const pull = (await pulled.json()) as PullResponse;
    expect(pull.cursor).toBe(usecase.current_revision_id);
    expect(pull.files).toHaveLength(1);
    expect(pull.files[0]).toMatchObject({
      path: `specs/${usecase.key}.md`,
      revision: usecase.current_revision_id
    });
    expect(pull.files[0]?.content).toContain(
      `revision: ${usecase.current_revision_id}`
    );
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

  test("pull reconciles server scenario and step mutations to the latest revision", async () => {
    const { mainStep, setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Sync Server Mutation",
      "sync-server-mutation",
      "stub-sync-server-mutation"
    );

    const extensionResponse = await createExtensionScenario(
      server,
      usecase.id,
      setup.cookie,
      {
        condition: "Payment is declined.",
        extension_point: "1a",
        outcome: "FAILURE"
      }
    );
    const extension = (await extensionResponse.json()) as ScenarioResponse;

    await expectPulledRevision(
      server,
      setup,
      extension.revision.id,
      "### 1a. Payment is declined."
    );

    const extensionStepResponse = await addStep(
      server,
      extension.scenario.id,
      setup.cookie,
      { action: "Uses a backup card.", actor: "Customer" }
    );
    const extensionStep = (await extensionStepResponse.json()) as StepResponse;

    await expectPulledRevision(
      server,
      setup,
      extensionStep.revision.id,
      "- 1a1. **Customer** Uses a backup card."
    );

    const editedResponse = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Reviews the order.",
      base_revision: extensionStep.revision.id
    });
    const edited = (await editedResponse.json()) as StepPatchResponse;
    const pulled = await expectPulledRevision(
      server,
      setup,
      edited.revision.id,
      "1. **Customer** Reviews the order."
    );
    const exported = await exportMarkdown(server, usecase.id, setup.cookie);

    expect(exported.status).toBe(200);
    expect(await exported.text()).toBe(pulled.files[0]?.content);
  });

  test("3a: malformed push file returns doctor guidance without a revision", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Sync Parse",
      "sync-parse",
      "stub-sync-parse"
    );
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
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Sync Conflict",
      "sync-conflict",
      "stub-sync-conflict"
    );
    const pulled = await syncPull(server, setup);
    const pull = (await pulled.json()) as PullResponse;
    const originalContent = pull.files[0]?.content ?? "";
    const baseRevision = pull.files[0]?.revision ?? "";
    const path = `specs/${usecase.key}.md`;

    const serverPush = await syncPush(server, setup, {
      base_revision: baseRevision,
      content: originalContent.replace(
        "# Places an order",
        "# Places an order on server"
      ),
      path
    });
    const serverRevision =
      ((await serverPush.json()) as PushResponse).results[0]?.current_revision ?? "";

    const stalePush = await syncPush(server, setup, {
      base_revision: baseRevision,
      content: originalContent.replace(
        "# Places an order",
        "# Places an order locally"
      ),
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
    expect(conflict.results[0]?.conflict_content).toContain(
      `>>>>>>> remote (${serverRevision}`
    );
    const remoteConflict = remoteHalf(conflict.results[0]?.conflict_content ?? "");
    expect(remoteConflict).toContain("## Stakeholders and Interests");
    expect(remoteConflict).toContain("## Main Success Scenario");
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

    const revisions = await historyRevisions(server, setup.cookie, usecase.id);
    expect(revisions[0]).toBe(serverRevision);
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

function remoteHalf(conflictContent: string) {
  return conflictContent.split("=======\n")[1]?.split("\n>>>>>>> remote")[0] ?? "";
}

async function expectPulledRevision(
  server: TestServer,
  setup: { cookie: string; projectId: string },
  revisionId: string,
  expectedContent: string
) {
  const pulled = await syncPull(server, setup);
  expect(pulled.status).toBe(200);
  const body = (await pulled.json()) as PullResponse;
  expect(body.cursor).toBe(revisionId);
  expect(body.files[0]?.revision).toBe(revisionId);
  expect(body.files[0]?.content).toContain(`revision: ${revisionId}`);
  expect(body.files[0]?.content).toContain(expectedContent);
  return body;
}

function exportMarkdown(server: TestServer, usecaseId: string, cookie: string) {
  return server.fetch(`/v1/usecases/${usecaseId}/export/markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({})
  });
}
