import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createUseCaseWithMainStep } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type SessionStartResponse = {
  session: {
    agent_identifier: string;
    agent_type: string;
    branch_id: null | string;
    id: string;
    intent: string;
    pinned_revisions: Record<string, string>;
    project_id: string;
    started_at: string;
    status: string;
    user_id: string;
  };
  session_file: {
    path: string;
    session_id: string;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type SessionProblemResponse = {
  offending_key?: string;
  session_count?: number;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-016 - Start a work session", () => {
  test("MAIN: start session with pinned current use case revision", async () => {
    const { mainStepRevision, setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Start Session",
      "start-session",
      "stub-start-session"
    );

    const response = await server.fetch("/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setup.cookie,
        "X-Vspec-Agent": "codex-cli"
      },
      body: JSON.stringify({
        agent_type: "CODEX",
        intent: "Implement checkout validation",
        pins: [usecase.key],
        project_id: setup.projectId
      })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as SessionStartResponse;
    expect(body.session).toMatchObject({
      agent_identifier: "codex-cli",
      agent_type: "CODEX",
      branch_id: null,
      intent: "Implement checkout validation",
      pinned_revisions: { [usecase.id]: mainStepRevision.id },
      project_id: setup.projectId,
      status: "ACTIVE",
      user_id: setup.userId
    });
    expect(body.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
    );
    expect(Date.parse(body.session.started_at)).not.toBeNaN();
    expect(body.session_file).toEqual({
      path: ".vspec/session.json",
      session_id: body.session.id
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key} --session ${body.session.id}`,
      reason: "Open the pinned use case revision."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec session complete",
      reason: "Close the session when the work is done."
    });
  });

  test("3a: archived pin is rejected without creating a session", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Archived Session Pin",
      "archived-session-pin",
      "stub-archived-session-pin"
    );
    const archived = await server.fetch(`/__test/usecases/${usecase.id}/archive`, {
      method: "POST"
    });
    expect(archived.status).toBe(200);

    const response = await server.fetch("/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setup.cookie,
        "X-Vspec-Agent": "codex-cli"
      },
      body: JSON.stringify({
        agent_type: "CODEX",
        intent: "Work on archived flow",
        pins: [usecase.key],
        project_id: setup.projectId
      })
    });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as SessionProblemResponse;
    expect(problem.title).toMatch(/pinned use case is archived/i);
    expect(problem.offending_key).toBe(usecase.key);
    expect(problem.session_count).toBe(0);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec usecase restore ${usecase.key}`,
      reason: "Restore the archived use case before pinning it."
    });
  });
});
