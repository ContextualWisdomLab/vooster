import { expect } from "vitest";
import { projectUseCase } from "./merge-fixtures.js";
import type { TestServer } from "./server.js";

type SyncSetup = { cookie: string; projectId: string };
export type PullResponse = {
  cursor: string;
  files: Array<{ content: string; path: string; revision: string }>;
};
export type PushResponse = {
  cache: { entries: Array<{ path: string; revision: string; status: string }> };
  results: Array<{
    conflict_content?: string;
    current_revision: string;
    dry_run?: boolean;
    impact?: { entity_id: string; severity: string };
    path: string;
    status: string;
  }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
export type SyncProblem = {
  offending_files: Array<{ line: number; message: string; path: string }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
export type NetworkFailureProblem = SyncProblem & {
  pending_push: {
    files: Array<{ base_revision: string; path: string }>;
    status: "QUEUED";
  };
};

export function syncPull(server: TestServer, setup: SyncSetup) {
  return server.fetch(`/v1/projects/${setup.projectId}/sync/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ branch: "main" })
  });
}

export function syncPush(
  server: TestServer,
  setup: SyncSetup,
  file: { base_revision: string; content: string | undefined; path: string },
  options: { dry_run?: boolean; simulate_network_failure?: boolean } = {}
) {
  return server.fetch(`/v1/projects/${setup.projectId}/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ branch: "main", files: [file], ...options })
  });
}

export async function pulledSyncFile(server: TestServer, setup: SyncSetup, key: string) {
  const pulled = await syncPull(server, setup);
  const body = (await pulled.json()) as PullResponse;
  return {
    content: body.files[0]?.content ?? "",
    path: `specs/${key}.md`
  };
}

export async function historyRevisions(server: TestServer, cookie: string, usecaseId: string) {
  const history = await server.fetch(`/v1/usecases/${usecaseId}/revisions`, {
    headers: { Cookie: cookie }
  });
  const body = (await history.json()) as {
    revisions: Array<{ revision: string; version_number: number }>;
  };
  return body.revisions.map((revision) => revision.revision);
}

export async function expectHistoryRevisions(
  server: TestServer,
  cookie: string,
  usecaseId: string,
  expected: string[]
) {
  await expect(historyRevisions(server, cookie, usecaseId)).resolves.toEqual(expected);
}

export async function expectDryRunSyncPush(server: TestServer) {
  const { setup, usecase } =
    await projectUseCase(server, "Sync Dry Run", "sync-dry-run", "stub-sync-dry-run");
  const { content, path } = await pulledSyncFile(server, setup, usecase.key);
  const dryRun = await syncPush(server, setup, {
    base_revision: usecase.current_revision_id,
    content: content.replace("# Reviews a refund", "# Reviews a refund later"),
    path
  }, { dry_run: true });
  expect(dryRun.status).toBe(200);
  const push = (await dryRun.json()) as PushResponse;
  expect(push.results[0]).toMatchObject({
    current_revision: usecase.current_revision_id,
    dry_run: true,
    path,
    status: "OK"
  });
  expect(push.cache.entries).toEqual([]);
  await expectHistoryRevisions(server, setup.cookie, usecase.id, [
    usecase.current_revision_id
  ]);
}

export async function expectNetworkFailureSyncPush(server: TestServer) {
  const { setup, usecase } =
    await projectUseCase(server, "Sync Network", "sync-network", "stub-sync-network");
  const { content, path } = await pulledSyncFile(server, setup, usecase.key);
  const failed = await syncPush(server, setup, {
    base_revision: usecase.current_revision_id,
    content: content.replace("# Reviews a refund", "# Reviews a refund offline"),
    path
  }, { simulate_network_failure: true });
  expect(failed.status).toBe(503);
  const problem = (await failed.json()) as NetworkFailureProblem;
  expect(problem.title).toMatch(/sync network unavailable/i);
  expect(problem.pending_push).toEqual({
    files: [{ base_revision: usecase.current_revision_id, path }],
    status: "QUEUED"
  });
  expect(problem.suggested_next_actions).toContainEqual({
    command: "vspec push",
    reason: "Retry the queued push once connectivity returns."
  });
  await expectHistoryRevisions(server, setup.cookie, usecase.id, [
    usecase.current_revision_id
  ]);
}
