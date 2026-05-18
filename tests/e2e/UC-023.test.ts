import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { lockUseCase, type LockCreateResponse } from "../helpers/lock-fixtures.js";
import {
  advanceBranch,
  advanceMain,
  createBranch,
  openMerge,
  projectUseCase,
  type MergeOpenResponse
} from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";
import { whoUseCase, type WhoProblem, type WhoResponse } from "../helpers/who-fixtures.js";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-023 - See who is working on a use case", () => {
  test("MAIN: show active sessions locks and merge requests for a use case", async () => {
    const { setup, usecase } = await projectUseCase(server, "Who Works", "who-works", "stub-who-works");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Coordinate on refund review",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const locked = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Session is editing semantics."
    }, session.id);
    const lock = ((await locked.json()) as LockCreateResponse).lock;
    const branch = await createBranch(server, setup, "feature/who-open-merge");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const opened = await openMerge(server, setup, branch.id);
    const merge = ((await opened.json()) as MergeOpenResponse).merge_request;

    const response = await whoUseCase(server, setup, usecase.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as WhoResponse;
    expect(body.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(body.sessions).toContainEqual(expect.objectContaining({
      agent_type: "CODEX",
      id: session.id,
      intent: "Coordinate on refund review",
      user_id: setup.userId
    }));
    expect(Date.parse(body.sessions[0]?.started_at ?? "")).not.toBeNaN();
    expect(body.locks).toContainEqual(expect.objectContaining({
      held_by_session_id: session.id,
      held_by_user_id: setup.userId,
      id: lock.id,
      lock_type: "SEMANTIC"
    }));
    expect(body.merge_requests).toContainEqual({
      conflict_count: merge.conflicts.length,
      id: merge.id,
      source_branch_id: branch.id,
      status: "OPEN"
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec lock list",
      reason: "Review active locks before editing."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec merge show ${merge.id}`,
      reason: "Review the open merge request touching this use case."
    });
  });

  test("2a: missing use case returns search guidance", async () => {
    const { setup } = await projectUseCase(server, "Missing Who", "missing-who", "stub-missing-who");

    const response = await whoUseCase(server, setup, "CHK-999");

    expect(response.status).toBe(404);
    const problem = (await response.json()) as WhoProblem;
    expect(problem.title).toMatch(/use case not found/i);
    expect(problem.key_format).toBe("KEY-NNN");
    expect(problem.sessions).toBeUndefined();
    expect(problem.locks).toBeUndefined();
    expect(problem.merge_requests).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec usecase search CHK-999",
      reason: "Search for the intended use case key."
    });
  });

  test("2b: archived use case still reports active work with restore guidance", async () => {
    const { setup, usecase } = await projectUseCase(server, "Archived Who", "archived-who", "stub-archived-who");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Finish archived work",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Archived flow still has active work."
    }, session.id);
    const archived = await server.fetch(`/__test/usecases/${usecase.id}/archive`, {
      method: "POST"
    });
    expect(archived.status).toBe(200);

    const response = await whoUseCase(server, setup, usecase.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as WhoResponse;
    expect(body.archived).toBe(true);
    expect(body.sessions).toContainEqual(expect.objectContaining({ id: session.id }));
    expect(body.locks).toHaveLength(1);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase restore ${usecase.key}`,
      reason: "Restore the archived use case before coordinating active work."
    });
  });

  test("4a: empty who result suggests starting a session", async () => {
    const { setup, usecase } = await projectUseCase(server, "Empty Who", "empty-who", "stub-empty-who");

    const response = await whoUseCase(server, setup, usecase.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as WhoResponse;
    expect(body.sessions).toEqual([]);
    expect(body.locks).toEqual([]);
    expect(body.merge_requests).toEqual([]);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec session start --intent "..." --pin ${usecase.key}`,
      reason: "Start a session on this use case."
    });
  });

  test("3a: stale session is marked zombie with abandon guidance", async () => {
    const { setup, usecase } = await projectUseCase(server, "Zombie Who", "zombie-who", "stub-zombie-who");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Stale coordination",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const aged = await server.fetch(`/__test/sessions/${session.id}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_activity_at: "2020-01-01T00:00:00.000Z" })
    });
    expect(aged.status).toBe(200);

    const response = await whoUseCase(server, setup, usecase.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as WhoResponse;
    expect(body.sessions[0]?.markers).toContain("ZOMBIE");
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec session abandon ${session.id}`,
      reason: "Review and explicitly abandon the stale active session."
    });
  });
});
