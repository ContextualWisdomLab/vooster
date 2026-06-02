import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createUseCaseWithMainStep } from "../../helpers/scenario-fixtures.js";
import {
  startWorkSession,
  type SessionStartResponse
} from "../../helpers/session-fixtures.js";
import { createProject, type ProjectSetup } from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;

type ProblemBody = { title: string };

describe("session list routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "Session List", "session-list", "stub-sl");
  });

  afterEach(async () => {
    await server.stop();
  });

  test.each(["/v1/sessions", "/v1/sessions/watch"])(
    "rejects invalid session list queries on %s",
    async (url) => {
      const response = await server.fetch(url, { headers: { Cookie: setup.cookie } });

      expect(response.status).toBe(400);
      expect((await response.json()) as ProblemBody).toMatchObject({
        title: "Invalid session list request"
      });
    }
  );

  test("returns a problem response when watching without workspace membership", async () => {
    const other = await createProject(server, "Other WS", "other-ws", "stub-sl-other");

    const response = await server.fetch(
      `/v1/sessions/watch?workspace_id=${other.workspaceId}`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(403);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Workspace membership required"
    });
  });

  test("returns a snapshot event stream for watch requests", async () => {
    const response = await server.fetch(
      `/v1/sessions/watch?workspace_id=${setup.workspaceId}`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("event: snapshot");
  });

  test("returns session list snapshots", async () => {
    const response = await server.fetch(
      `/v1/sessions?workspace_id=${setup.workspaceId}`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as { total: number }).toMatchObject({ total: 0 });
  });

  test("rejects heartbeat updates for missing sessions and invalid timestamps", async () => {
    const { setup: liveSetup, usecase } = await createUseCaseWithMainStep(
      server,
      "Heartbeat",
      "heartbeat",
      "stub-heartbeat"
    );
    const started = await startWorkSession(server, liveSetup, {
      agent_type: "CODEX",
      intent: "Track work",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const missing = await server.fetch("/__test/sessions/missing/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_activity_at: "2026-05-20T00:00:00.000Z" })
    });
    const invalid = await server.fetch(`/__test/sessions/${session.id}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_activity_at: "not-a-date" })
    });

    expect(missing.status).toBe(404);
    expect((await missing.json()) as ProblemBody).toMatchObject({
      title: "Session not found"
    });
    expect(invalid.status).toBe(404);
    expect((await invalid.json()) as ProblemBody).toMatchObject({
      title: "Session not found"
    });
  });

  test("updates session heartbeat timestamps", async () => {
    const { setup: liveSetup, usecase } = await createUseCaseWithMainStep(
      server,
      "Heartbeat Update",
      "heartbeat-update",
      "stub-heartbeat-update"
    );
    const started = await startWorkSession(server, liveSetup, {
      agent_type: "CODEX",
      intent: "Track work",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const response = await server.fetch(`/__test/sessions/${session.id}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_activity_at: "2026-05-20T00:30:00.000Z" })
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as { updated: boolean }).toEqual({ updated: true });
  });
});
