import { expect } from "vitest";
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
