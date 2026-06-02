import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { lockUseCase } from "../../helpers/lock-fixtures.js";
import {
  startWorkSession,
  type SessionStartResponse
} from "../../helpers/session-fixtures.js";
import {
  createActor,
  createProject,
  createUseCase,
  type ProjectSetup,
  type UseCase
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;
let usecase: UseCase;

type ProblemBody = { title: string };

describe("POST /v1/sessions integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "Session Start", "session-start", "stub-ss");
    await createActor(server, setup, "Customer");
    usecase = await createUseCase(server, setup, "Customer", "Places an order");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed session requests", async () => {
    const response = await server.fetch("/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ intent: "Missing pins", project_id: setup.projectId })
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Invalid session request"
    });
  });

  test("rejects session starts from non-members", async () => {
    const outsider = await createProject(server, "Outsider", "outsider", "stub-ss-out");

    const response = await startWorkSession(
      server,
      {
        cookie: outsider.cookie,
        projectId: setup.projectId
      },
      {
        agent_type: "CODEX",
        intent: "Sneak in",
        pins: [usecase.key]
      }
    );

    expect(response.status).toBe(403);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Contact the workspace owner for access"
    });
  });

  test("reports missing pinned use cases", async () => {
    const response = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Pin a ghost",
      pins: ["CHK-999"]
    });

    expect(response.status).toBe(422);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Pinned use case not found"
    });
  });

  test("reports archived pinned use cases", async () => {
    const archived = await createUseCase(
      server,
      setup,
      "Customer",
      "Reviews archived flow"
    );
    const archiveResponse = await server.fetch(`/v1/usecases/${archived.id}`, {
      method: "DELETE",
      headers: { Cookie: setup.cookie }
    });
    expect(archiveResponse.status).toBe(200);

    const response = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Pin an archived flow",
      pins: [archived.key]
    });

    expect(response.status).toBe(422);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Pinned use case is archived"
    });
  });

  test("reports hard-locked pinned use cases", async () => {
    const locked = await lockUseCase(server, setup, usecase.id, {
      lock_type: "HARD",
      reason: "Owns destructive edits."
    });
    expect(locked.status).toBe(201);

    const response = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Pin a hard-locked use case",
      pins: [usecase.key]
    });

    expect(response.status).toBe(409);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Pinned use case is hard-locked"
    });
  });

  test("reports semantic-locked pinned use cases on auto-branch starts", async () => {
    const locked = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Owns semantic edits."
    });
    expect(locked.status).toBe(201);

    const response = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      intent: "Pin a semantic-locked use case",
      pins: [usecase.key]
    });

    expect(response.status).toBe(409);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Pinned use case has a semantic lock"
    });
  });

  test("maps simulated write failures to a problem response", async () => {
    const response = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Trigger write failure",
      pins: [usecase.key],
      simulate_write_failure: true
    });

    expect(response.status).toBe(500);
    expect((await response.json()) as ProblemBody).toMatchObject({
      title: "Session creation failed"
    });
  });

  test("starts sessions with the agent header as identifier", async () => {
    const response = await startWorkSession(
      server,
      setup,
      { agent_type: "CODEX", intent: "Implement order flow", pins: [usecase.key] },
      "codex-cli"
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as SessionStartResponse;
    expect(body.session).toMatchObject({
      agent_identifier: "codex-cli",
      agent_type: "CODEX",
      project_id: setup.projectId,
      status: "ACTIVE"
    });
    expect(body.session.pinned_revisions[usecase.id]).toBeDefined();
    expect(body.session_file.session_id).toBe(body.session.id);
  });
});
