import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const tempRoots: string[] = [];

afterEach(() => {
  cleanupCliE2e();
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("UC-030 CLI - Export a use case to Gherkin", () => {
  test("MAIN: agent exports main and extension scenarios to a feature file", async () => {
    const server = await startNetworkServer("vspec-cli-uc030-");
    const root = mkdtempSync(join(tmpdir(), "vspec-cli-gherkin-"));
    tempRoots.push(root);
    try {
      const setup = await createGherkinReadyUseCase(server.apiUrl);
      const outputPath = join(root, "features", `${setup.usecaseKey}.feature`);
      const result = await runCli([
        "export",
        "gherkin",
        setup.usecaseId,
        "--output",
        outputPath,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`Exported ${outputPath}`);
      expect(result.stdout).toContain("Bytes ");
      await expect(readFile(outputPath, "utf8")).resolves.toBe(`Feature: Places an order

Background:
  Given the use case is in scope ghr

Scenario: Main success
  When Customer Places an order.

Scenario: 1a Payment is declined.
  Given main success reaches step 1
  When Customer Uses a backup card.
  Then outcome is FAILURE
`);
    } finally {
      await server.stop();
    }
  });
});

async function createGherkinReadyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "GHR", name: "Gherkin", visibility: "PRIVATE" },
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
  const extension = await postJson<ScenarioResponse>(
    `${apiUrl}/v1/usecases/${usecase.usecase.id}/scenarios`,
    {
      condition: "Payment is declined.",
      extension_point: "1a",
      outcome: "FAILURE",
      type: "EXTENSION"
    },
    headers
  );
  await addStep(apiUrl, extension.scenario.id, "Uses a backup card.", headers);

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
  await postJson(
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
        name: "CLI Gherkin",
        slug: "cli-gherkin"
      }
    },
    jsonHeaders()
  );
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-gherkin-owner");
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
