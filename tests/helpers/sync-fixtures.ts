import type { TestServer } from "./server.js";

type SyncSetup = { cookie: string; projectId: string };

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
  options: { dry_run?: boolean } = {}
) {
  return server.fetch(`/v1/projects/${setup.projectId}/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ branch: "main", files: [file], ...options })
  });
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
