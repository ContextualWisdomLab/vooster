import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createUseCaseWithMainStep } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";
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
    pinned_keys: string[];
    project_id: string;
    started_at: string;
    status: string;
    user_id: string;
  }>;
  summary: { total_conflicts: number };
  total: number;
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
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "List Sessions", "list-sessions", "stub-list-sessions");
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

    const response = await server.fetch(`/v1/sessions?workspace_id=${setup.workspaceId}`, {
      headers: { Cookie: setup.cookie }
    });

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
});
