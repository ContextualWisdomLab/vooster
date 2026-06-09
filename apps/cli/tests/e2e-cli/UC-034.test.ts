import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = { workspace: { id: string } };
type OAuthStartResponse = { state: string };
type ProjectResponse = { project: { id: string } };
type UseCaseResponse = {
  usecase: {
    id: string;
    key: string;
  };
};
type ScenarioResponse = { scenario: { id: string } };
type AgentUseCaseResponse = {
  context: {
    branch: string;
    project_key: string;
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

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-034 CLI - Fetch a structured spec", () => {
  test("MAIN: agent fetches a use case as a structured JSON envelope", async () => {
    const server = await startNetworkServer("vspec-cli-uc034-");
    try {
      const setup = await createAgentReadableUseCase(server.apiUrl);
      const result = await runCli([
        "usecase",
        "show",
        setup.usecaseKey,
        "--format",
        "agent",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const envelope = JSON.parse(result.stdout) as AgentUseCaseResponse;
      expect(envelope.format_version).toBe(1);
      expect(envelope.context).toMatchObject({
        branch: "main",
        project_key: "AGT",
        session_id: null
      });
      expect(envelope.context.revision).toMatch(/[0-9a-f-]{36}/);
      expect(envelope.data.usecase).toMatchObject({
        id: setup.usecaseId,
        key: setup.usecaseKey
      });
      expect(envelope.data.title).toBe("Places an order");
      expect(envelope.data.primary_actor).toEqual({ name: "Customer" });
      expect(envelope.data.scenarios[0]?.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "Places an order.",
            actor: "Customer",
            invokes: [],
            step_number: 1
          })
        ])
      );
      expect(envelope.data.stakeholder_interests).toEqual([
        { interest: "Checkout revenue is protected.", stakeholder: "Product Manager" }
      ]);
      expect(envelope.warnings).toEqual([]);
      expect(envelope.suggested_next_actions).toContainEqual({
        command: `vspec change propose ${setup.usecaseKey}`,
        reason: "Propose a reviewed spec change after reading the pinned snapshot."
      });
      expect(envelope.suggested_next_actions).toContainEqual({
        command: `vspec export gherkin ${setup.usecaseKey}`,
        reason: "Generate executable acceptance-test scaffolding."
      });
    } finally {
      await server.stop();
    }
  });
});

async function createAgentReadableUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "AGT", name: "Agent Fetch", visibility: "PRIVATE" },
    headers
  );
  await postJson(
    `${apiUrl}/v1/projects/${project.project.id}/actors`,
    {
      aliases: ["Buyer"],
      description: "Person buying a product.",
      is_human: true,
      name: "Customer",
      type: "PRIMARY"
    },
    headers
  );
  await postJson(
    `${apiUrl}/v1/projects/${project.project.id}/stakeholders`,
    {
      description: "Owns checkout revenue.",
      name: "Product Manager",
      type: "INTERNAL"
    },
    headers
  );
  const usecase = await postJson<UseCaseResponse>(
    `${apiUrl}/v1/projects/${project.project.id}/usecases`,
    { primary_actor: "Customer", title: "Places an order" },
    headers
  );
  await postJson(
    `${apiUrl}/v1/usecases/${usecase.usecase.id}/stakeholder-interests`,
    {
      interest: "Checkout revenue is protected.",
      protection_mechanism: "Success guarantee",
      stakeholder: "Product Manager"
    },
    headers
  );
  const main = await postJson<ScenarioResponse>(
    `${apiUrl}/v1/usecases/${usecase.usecase.id}/scenarios`,
    { type: "MAIN_SUCCESS" },
    headers
  );
  await addStep(apiUrl, main.scenario.id, "Places an order.", headers);

  return {
    cookie: signedUp.cookie,
    usecaseId: usecase.usecase.id,
    usecaseKey: usecase.usecase.key
  };
}

async function addStep(
  apiUrl: string,
  scenarioId: string,
  action: string,
  headers: Record<string, string>
) {
  return postJson(
    `${apiUrl}/v1/scenarios/${scenarioId}/steps`,
    {
      action,
      actor: "Customer"
    },
    headers
  );
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(
    `${apiUrl}/v1/auth/github/start`,
    {
      workspace: {
        name: "CLI Agent Fetch",
        slug: "cli-agent-fetch"
      }
    },
    jsonHeaders()
  );
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-agent-fetch-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, { headers: { Cookie: start.cookie } });
  const callbackBody = (await callback.json()) as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<T & { cookie: string }> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers,
    method: "POST"
  });
  const responseBody = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`Setup request failed with ${String(response.status)}`);
  }
  return { ...responseBody, cookie: response.headers.get("set-cookie") ?? "" };
}

function jsonHeaders(cookie?: string): Record<string, string> {
  return cookie === undefined
    ? { "Content-Type": "application/json" }
    : { "Content-Type": "application/json", Cookie: cookie };
}
