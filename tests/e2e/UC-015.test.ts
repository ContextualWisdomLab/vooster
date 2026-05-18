import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

type ArchiveResponse = {
  active_locks_count: number;
  affected_sessions_count: number;
  revision: { change_summary: string; id: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: { archived_at: string; id: string; key: string };
};
type HistoryResponse = { revisions: Array<{ change_summary?: string; version_number: number }> };
type SearchResponse = { items: Array<{ key: string }> };

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-015 - Archive or restore a use case", () => {
  test("MAIN: archive soft-deletes, writes revision, and hides from default list", async () => {
    const setup = await createProject(server, "Archive Main", "archive-main", "stub-archive-main");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews archived scope");

    const response = await archiveUseCase(usecase.id, setup.cookie);

    expect(response.status).toBe(200);
    const body = (await response.json()) as ArchiveResponse;
    expect(body.usecase).toMatchObject({ id: usecase.id, key: usecase.key });
    expect(Date.parse(body.usecase.archived_at)).not.toBeNaN();
    expect(body.affected_sessions_count).toBe(0);
    expect(body.active_locks_count).toBe(0);
    expect(body.revision.change_summary).toBe(`Archived use case ${usecase.key}`);
    expect(typeof body.revision.id).toBe("string");
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase restore ${usecase.key}`,
      reason: "Restore the use case if it returns to scope."
    });

    const history = await revisionHistory(usecase.id, setup.cookie);
    expect(history.revisions.map((revision) => revision.version_number)).toEqual([2, 1]);
    expect(history.revisions[0]?.change_summary).toBe(`Archived use case ${usecase.key}`);

    const list = await listUseCases(setup.projectId, setup.cookie);
    expect(list.items).toEqual([]);
  });
});

function archiveUseCase(usecaseId: string, cookie: string) {
  return server.fetch(`/v1/usecases/${usecaseId}`, {
    method: "DELETE",
    headers: { Cookie: cookie }
  });
}

async function revisionHistory(usecaseId: string, cookie: string) {
  const response = await server.fetch(`/v1/usecases/${usecaseId}/revisions`, {
    headers: { Cookie: cookie }
  });
  return (await response.json()) as HistoryResponse;
}

async function listUseCases(projectId: string, cookie: string) {
  const response = await server.fetch(`/v1/projects/${projectId}/usecases`, {
    headers: { Cookie: cookie }
  });
  return (await response.json()) as SearchResponse;
}
