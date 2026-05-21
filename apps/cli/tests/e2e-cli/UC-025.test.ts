import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = { workspace: { id: string } };
type OAuthStartResponse = { state: string };
type ProjectResponse = { project: { id: string } };
type UseCaseResponse = { usecase: { id: string; key: string } };
type ScenarioResponse = { scenario: { id: string } };
type StepResponse = { revision: { id: string } };

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-025 CLI - Compare two use case revisions", () => {
  test("MAIN: project member compares revisions as a structural diff", async () => {
    const server = await startNetworkServer("vspec-cli-uc025-");
    try {
      const setup = await createUseCaseWithTwoSteps(server.apiUrl);
      const result = await runCli([
        "diff",
        setup.usecaseId,
        setup.fromRevision,
        setup.toRevision,
        "--format",
        "human",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`UseCase ${setup.usecaseKey}`);
      expect(result.stdout).toContain(`From ${setup.fromRevision}`);
      expect(result.stdout).toContain(`To ${setup.toRevision}`);
      expect(result.stdout).toContain("Summary breaking 0 non_breaking 1 cosmetic 0");
      expect(result.stdout).toContain("Change ADD STEP main_success.steps[2]");
      expect(result.stdout).toContain(`Revision ${setup.toRevision}`);
      expect(result.stdout).toContain("Severity NON_BREAKING");
      expect(result.stdout).toContain(`vspec revert ${setup.usecaseKey} --to ${setup.fromRevision}`);
      expect(result.stdout).toContain(`vspec impact ${setup.usecaseKey}`);
      expect(result.stdout).toContain("vspec merge open");
    } finally {
      await server.stop();
    }
  });
});

async function createUseCaseWithTwoSteps(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "DIF", name: "Diff", visibility: "PRIVATE" },
    headers
  );
  await postJson(`${apiUrl}/v1/projects/${project.project.id}/actors`, {
    aliases: ["Buyer"],
    description: "Person buying a product.",
    is_human: true,
    name: "Customer",
    type: "PRIMARY"
  }, headers);
  await postJson(`${apiUrl}/v1/projects/${project.project.id}/stakeholders`, {
    description: "Owns checkout revenue.",
    name: "Product Manager",
    type: "INTERNAL"
  }, headers);
  const usecase = await postJson<UseCaseResponse>(
    `${apiUrl}/v1/projects/${project.project.id}/usecases`,
    { primary_actor: "Customer", title: "Reviews order revisions" },
    headers
  );
  await postJson(`${apiUrl}/v1/usecases/${usecase.usecase.id}/stakeholder-interests`, {
    interest: "Order review changes stay understandable.",
    protection_mechanism: "Success guarantee",
    stakeholder: "Product Manager"
  }, headers);
  const scenario = await postJson<ScenarioResponse>(
    `${apiUrl}/v1/usecases/${usecase.usecase.id}/scenarios`,
    { type: "MAIN_SUCCESS" },
    headers
  );
  const firstStep = await addStep(apiUrl, scenario.scenario.id, "Reviews order status.", headers);
  const secondStep = await addStep(apiUrl, scenario.scenario.id, "Confirms order.", headers);

  return {
    cookie: signedUp.cookie,
    fromRevision: firstStep.revision.id,
    toRevision: secondStep.revision.id,
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
  return postJson<StepResponse>(
    `${apiUrl}/v1/scenarios/${scenarioId}/steps`,
    { action, actor: "Customer" },
    headers
  );
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(`${apiUrl}/v1/auth/github/start`, {
    workspace: {
      name: "CLI Diff",
      slug: "cli-diff"
    }
  }, jsonHeaders());
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-diff-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.cookie
    }
  });
  const callbackBody = await callback.json() as SignupResponse;

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
  const responseBody = await response.json() as T;
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
