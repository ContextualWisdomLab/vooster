import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createUseCaseWithMainStep } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  startWorkSession,
  type SessionStartResponse
} from "../helpers/session-fixtures.js";
import { createStepLock } from "../helpers/step-fixtures.js";

type SessionListResponse = {
  sessions: Array<{
    agent_identifier: string;
    agent_type: string;
    branch_name: null | string;
    conflict_markers: string[];
    id: string;
    idle_seconds: number;
    intent: string;
    lock_count: number;
    markers?: string[];
    pinned_keys: string[];
    project_id: string;
    started_at: string;
    status: string;
    user_id: string;
  }>;
  summary: { total_conflicts: number };
  suggested_next_actions?: Array<{ command: string; reason: string }>;
  total: number;
};
type SessionListProblem = {
  sessions?: unknown;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
  total?: unknown;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-017 - Monitor active sessions", () => {
  test("MAIN: list active workspace sessions with derived fields", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "List Sessions",
      "list-sessions",
      "stub-list-sessions"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/list-session",
      intent: "Implement list monitoring",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    await createStepLock(server, usecase.id, setup.cookie, {
      expires_at: "2026-06-01T00:00:00.000Z",
      holder: session.id,
      mode: "SEMANTIC",
      reason: "Session owns semantic edits."
    });

    const response = await server.fetch(
      `/v1/sessions?workspace_id=${setup.workspaceId}`,
      {
        headers: { Cookie: setup.cookie }
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SessionListResponse;
    expect(body.total).toBe(1);
    expect(body.summary).toEqual({ total_conflicts: 0 });
    expect(body.sessions[0]).toMatchObject({
      agent_identifier: "codex-cli",
      agent_type: "CODEX",
      branch_name: "agent/list-session",
      conflict_markers: [],
      id: session.id,
      intent: "Implement list monitoring",
      lock_count: 1,
      pinned_keys: [usecase.key],
      project_id: setup.projectId,
      status: "ACTIVE",
      user_id: setup.userId
    });
    expect(body.sessions[0]?.idle_seconds).toBeGreaterThanOrEqual(0);
    expect(Date.parse(body.sessions[0]?.started_at ?? "")).not.toBeNaN();
  });

  test("4a: stale active session is marked zombie with abandon guidance", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Zombie Session",
      "zombie-session",
      "stub-zombie-session"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Forget to heartbeat",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const aged = await server.fetch(`/__test/sessions/${session.id}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_activity_at: "2020-01-01T00:00:00.000Z" })
    });
    expect(aged.status).toBe(200);

    const response = await server.fetch(
      `/v1/sessions?workspace_id=${setup.workspaceId}`,
      {
        headers: { Cookie: setup.cookie }
      }
    );

    const body = (await response.json()) as SessionListResponse;
    expect(body.sessions[0]?.markers).toContain("ZOMBIE");
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec session abandon ${session.id}`,
      reason: "Review and explicitly abandon the stale active session."
    });
  });

  test("3a: empty session list includes start guidance", async () => {
    const { setup } = await createUseCaseWithMainStep(
      server,
      "Empty Sessions",
      "empty-sessions",
      "stub-empty-sessions"
    );

    const response = await server.fetch(
      `/v1/sessions?workspace_id=${setup.workspaceId}`,
      {
        headers: { Cookie: setup.cookie }
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SessionListResponse;
    expect(body.total).toBe(0);
    expect(body.sessions).toEqual([]);
    expect(body.suggested_next_actions).toContainEqual({
      command: 'vspec session start --intent "..."',
      reason: "Start a session when work begins."
    });
  });

  test("*a: watch streams the session snapshot as server-sent events", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Watch Sessions",
      "watch-sessions",
      "stub-watch-sessions"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Watch active work",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const response = await server.fetch(
      `/v1/sessions/watch?workspace_id=${setup.workspaceId}`,
      {
        headers: { Cookie: setup.cookie }
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain("event: snapshot");
    expect(body).toContain(`"id":"${session.id}"`);
  });

  test("2a: non-member cannot list another workspace sessions", async () => {
    const mine = await createUseCaseWithMainStep(
      server,
      "Mine Sessions",
      "mine-sessions",
      "stub-mine-sessions"
    );
    const other = await createUseCaseWithMainStep(
      server,
      "Other Sessions",
      "other-sessions",
      "stub-other-sessions"
    );

    const response = await server.fetch(
      `/v1/sessions?workspace_id=${other.setup.workspaceId}`,
      {
        headers: { Cookie: mine.setup.cookie }
      }
    );

    expect(response.status).toBe(403);
    const problem = (await response.json()) as SessionListProblem;
    expect(problem.title).toMatch(/workspace membership required/i);
    expect(problem.total).toBeUndefined();
    expect(problem.sessions).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec workspace list",
      reason: "Choose a workspace you can access."
    });
  });
});
