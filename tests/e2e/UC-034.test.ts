import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { addStep, createUseCaseWithMainStep, type StepResponse } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";

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
    scenarios: Array<{ steps: Array<{ action: string; actor: string; step_number: number }> }>;
    stakeholder_interests: Array<{ interest: string; stakeholder: string }>;
    title: string;
    usecase: { id: string; key: string };
  };
  format_version: number;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: Array<{ message: string; type: string }>;
};

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-034 - Fetch a structured spec (AI agent)", () => {
  test("MAIN: fetch active use case as agent envelope", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Agent Fetch", "agent-fetch", "stub-agent-fetch");

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
      revision: usecase.current_revision_id,
      session_id: null
    });
    expect(body.data.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(body.data.title).toBe("Places an order");
    expect(body.data.primary_actor).toEqual({ name: "Customer" });
    expect(body.data.scenarios[0]?.steps).toEqual([
      { action: "Places an order.", actor: "Customer", step_number: 1 }
    ]);
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
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Agent Missing Revision", "agent-missing-revision", "stub-agent-missing-revision");

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
    const { scenario, setup, usecase } =
      await createUseCaseWithMainStep(server, "Agent Pinned", "agent-pinned", "stub-agent-pinned");
    const pinnedRevision = usecase.current_revision_id;
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Read pinned spec",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
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
      message: "Requested revision was ignored because the active session pins this use case."
    });
  });
});
