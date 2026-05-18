import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { lockUseCase, type LockCreateResponse } from "../helpers/lock-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

type ArchiveResponse = {
  active_locks_count: number;
  affected_sessions: Array<{ id: string; pinned_revision: string }>;
  affected_sessions_count: number;
  revision: { change_summary: string; id: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: { archived_at: string; id: string; key: string };
};
type HistoryResponse = { revisions: Array<{ change_summary?: string; version_number: number }> };
type ArchiveProblem = {
  archived_at?: string;
  expires_at?: string;
  holding_session?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
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
    expect(body.affected_sessions).toEqual([]);
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

  test("2a: already archived use case returns restore guidance", async () => {
    const setup = await createProject(server, "Archive Twice", "archive-twice", "stub-archive-twice");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews archive twice");
    const archived = (await (await archiveUseCase(usecase.id, setup.cookie)).json()) as ArchiveResponse;

    const response = await archiveUseCase(usecase.id, setup.cookie);

    expect(response.status).toBe(409);
    const problem = (await response.json()) as ArchiveProblem;
    expect(problem.title).toMatch(/already archived/i);
    expect(problem.archived_at).toBe(archived.usecase.archived_at);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec usecase restore ${usecase.key}`,
      reason: "Restore the archived use case instead."
    });
    const history = await revisionHistory(usecase.id, setup.cookie);
    expect(history.revisions.map((revision) => revision.version_number)).toEqual([2, 1]);
  });

  test("3a: archive succeeds while reporting active pinned sessions", async () => {
    const setup = await createProject(server, "Archive Sessions", "archive-sessions", "stub-archive-sessions");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews pinned archive");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Inspect archived flow",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const response = await archiveUseCase(usecase.id, setup.cookie);

    expect(response.status).toBe(200);
    const body = (await response.json()) as ArchiveResponse;
    expect(body.affected_sessions_count).toBe(1);
    expect(body.affected_sessions).toContainEqual({
      id: session.id,
      pinned_revision: usecase.current_revision_id
    });
  });

  test("3b: active hard lock blocks archive without writing a revision", async () => {
    const setup = await createProject(server, "Archive Locked", "archive-locked", "stub-archive-locked");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews locked archive");
    const created = await lockUseCase(server, setup, usecase.id, {
      lock_type: "HARD",
      reason: "Session owns the archive boundary."
    }, "session-archive-lock");
    const lock = ((await created.json()) as LockCreateResponse).lock;

    const response = await archiveUseCase(usecase.id, setup.cookie);

    expect(response.status).toBe(409);
    const problem = (await response.json()) as ArchiveProblem;
    expect(problem.title).toMatch(/hard lock/i);
    expect(problem.holding_session).toBe("session-archive-lock");
    expect(problem.expires_at).toBe(lock.expires_at);
    expect(await revisionHistory(usecase.id, setup.cookie))
      .toMatchObject({ revisions: [{ version_number: 1 }] });
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
