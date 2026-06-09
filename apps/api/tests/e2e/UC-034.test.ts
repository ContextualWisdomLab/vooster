import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createUseCaseWithMainStep,
  type StepResponse
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  startWorkSession,
  type SessionStartResponse
} from "../helpers/session-fixtures.js";
import { createUseCase } from "../helpers/uc-fixtures.js";

type AgentUseCaseResponse = {
  context: {
    branch: string;
    project_key: string;
    request_id: string;
    revision: string;
    session_id: null | string;
  };
  data: {
    primary_actor: { name: string };
    scenarios: Array<{
      steps: Array<{
        action: string;
        actor: string;
        invokes: string[];
        step_number: number;
      }>;
    }>;
    stakeholder_interests: Array<{ interest: string; stakeholder: string }>;
    title: string;
    usecase: { id: string; key: string };
  };
  format_version: number;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: Array<{ message: string; type: string }>;
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.stop();
});

describe("UC-034 - Fetch a structured spec (AI agent)", () => {
  test("MAIN: fetch active use case as agent envelope", async () => {
    const { mainStepRevision, setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Agent Fetch",
      "agent-fetch",
      "stub-agent-fetch"
    );

    const response = await server.fetch(`/v1/usecases/${usecase.id}?format=agent`, {
      headers: { Cookie: setup.cookie, "X-Vspec-Request-Id": "req-agent-fetch-main" }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as AgentUseCaseResponse;
    expect(body.format_version).toBe(1);
    expect(body.context).toEqual({
      branch: "main",
      project_key: "CHK",
      request_id: "req-agent-fetch-main",
      revision: mainStepRevision.id,
      session_id: null
    });
    expect(body.data.usecase).toMatchObject({ id: usecase.id, key: usecase.key });
    expect(body.data.title).toBe("Places an order");
    expect(body.data.primary_actor).toEqual({ name: "Customer" });
    const firstStep = body.data.scenarios[0]?.steps[0];
    expect(firstStep?.action).toBe("Places an order.");
    expect(firstStep?.actor).toBe("Customer");
    expect(firstStep?.invokes).toEqual([]);
    expect(firstStep?.step_number).toBe(1);
    expect(body.data.stakeholder_interests).toEqual([
      { interest: "Checkout revenue is protected.", stakeholder: "Product Manager" }
    ]);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec change propose ${usecase.key}`,
      reason: "Propose a reviewed spec change after reading the pinned snapshot."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec export gherkin ${usecase.key}`,
      reason: "Generate executable acceptance-test scaffolding."
    });
    expect(body.warnings).toEqual([]);
  });

  test("3a: missing requested revision returns history guidance", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Agent Missing Revision",
      "agent-missing-revision",
      "stub-agent-missing-revision"
    );

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}?format=agent&revision=missing-revision`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(404);
    const problem = (await response.json()) as {
      revision: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
      title: string;
    };
    expect(problem.title).toMatch(/revision not found/i);
    expect(problem.revision).toBe("missing-revision");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key}`,
      reason: "Find a valid revision for this use case."
    });
  });

  test("3b: session pin overrides requested revision", async () => {
    const { scenario, setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Agent Pinned",
      "agent-pinned",
      "stub-agent-pinned"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Read pinned spec",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const pinnedRevision = session.pinned_revisions[usecase.id] ?? "";
    const changed = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "Confirms the order.",
      actor: "Customer"
    });
    const newRevision = ((await changed.json()) as StepResponse).revision.id;

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}?format=agent&session=${session.id}&revision=${newRevision}`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as AgentUseCaseResponse;
    expect(body.context.revision).toBe(pinnedRevision);
    expect(body.context.session_id).toBe(session.id);
    expect(body.warnings).toContainEqual({
      type: "REVISION_OVERRIDDEN_BY_SESSION",
      message:
        "Requested revision was ignored because the active session pins this use case."
    });
  });

  test("4a: session without pin warns and suggests pinning", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Agent Unpinned",
      "agent-unpinned",
      "stub-agent-unpinned"
    );
    const other = await createUseCase(server, setup, "Customer", "Tracks an order");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Read unpinned spec",
      pins: [other.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}?format=agent&session=${session.id}`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as AgentUseCaseResponse;
    expect(body.context.session_id).toBe(session.id);
    expect(body.warnings).toContainEqual({
      type: "UNPINNED_SESSION_READ",
      message:
        "Session does not pin this use case; concurrent edits may change future reads."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec session pin ${usecase.key}`,
      reason: "Pin this use case before relying on it for edits."
    });
  });

  test("2a: unauthenticated caller gets login and API-key guidance", async () => {
    const { usecase } = await createUseCaseWithMainStep(
      server,
      "Agent Auth",
      "agent-auth",
      "stub-agent-auth"
    );

    const response = await server.fetch(`/v1/usecases/${usecase.id}?format=agent`);

    expect(response.status).toBe(401);
    const problem = (await response.json()) as {
      suggested_next_actions: Array<{ command: string; reason: string }>;
      title: string;
    };
    expect(problem.title).toMatch(/authentication required/i);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Authenticate before fetching private specs."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec api-key create --scopes read",
      reason: "Create a read-scoped key for non-interactive agents."
    });
  });

  test("*a: archived use case can be fetched read-only with explicit archive state", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Agent Archived",
      "agent-archived",
      "stub-agent-archived"
    );
    await server.fetch(`/__test/usecases/${usecase.id}/archive`, {
      method: "POST",
      headers: { Cookie: setup.cookie }
    });

    const response = await server.fetch(`/v1/usecases/${usecase.id}?format=agent`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { usecase: { archived_at: string; id: string; key: string } };
      suggested_next_actions: Array<{ command: string; reason: string }>;
    };
    expect(body.data.usecase.id).toBe(usecase.id);
    expect(body.data.usecase.key).toBe(usecase.key);
    expect(typeof body.data.usecase.archived_at).toBe("string");
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase restore ${usecase.key}`,
      reason: "Restore the archived use case before proposing edits."
    });
  });
});
