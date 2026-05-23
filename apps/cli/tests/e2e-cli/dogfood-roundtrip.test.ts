import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = { user: { id: string }; workspace: { id: string } };
type OAuthStartResponse = { state: string };
type ProjectResponse = { project: { id: string } };
type ScenarioResponse = { scenario: { id: string } };
type UseCaseResponse = { usecase: { id: string; key: string } };

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("CLI dogfood round-trip", () => {
  test("initializes by project key, pulls rendered markdown, and shows body sections without --project-id", async () => {
    const server = await startNetworkServer("vspec-cli-roundtrip-");
    const root = tempDir("vspec-cli-roundtrip-root-");
    const configDir = tempDir("vspec-cli-roundtrip-config-");
    const globalConfigPath = join(configDir, "config.json");

    try {
      const setup = await createRoundTripUseCase(server.apiUrl);
      await writeFile(
        globalConfigPath,
        `${JSON.stringify(
          {
            api_url: server.apiUrl,
            current_workspace_id: setup.workspaceId,
            session_token: setup.cookie
          },
          null,
          2
        )}\n`
      );
      const env = { VSPEC_GLOBAL_CONFIG_PATH: globalConfigPath };

      const initialized = await runCli(["init", "--project", setup.projectKey], env, {
        cwd: root
      });
      expect(initialized.stderr).toBe("");
      expect(initialized.status).toBe(0);

      const localConfig = JSON.parse(
        await readFile(join(root, ".vspec", "config.json"), "utf8")
      ) as Record<string, string>;
      expect(localConfig).toMatchObject({
        api_url: server.apiUrl,
        current_project_id: setup.projectId,
        current_project_key: setup.projectKey,
        current_workspace_id: setup.workspaceId
      });

      const pulled = await runCli(["pull"], env, { cwd: root });
      expect(pulled.stderr).toBe("");
      expect(pulled.status).toBe(0);
      expect(pulled.stdout).toContain(`File specs/${setup.usecaseKey}.md`);

      const markdown = await readFile(
        join(root, "specs", `${setup.usecaseKey}.md`),
        "utf8"
      );
      expect(markdown).toContain(
        "## Stakeholders and Interests\n\n- **Product Manager**: Checkout revenue is protected."
      );
      expect(markdown).toContain(
        "## Main Success Scenario\n\n1. **Customer** Places an order."
      );

      const shown = await runCli(["usecase", "show", setup.usecaseKey], env, {
        cwd: root
      });
      expect(shown.stderr).toBe("");
      expect(shown.status).toBe(0);
      expect(shown.stdout).toContain("Product Manager: Checkout revenue is protected.");
      expect(shown.stdout).toContain("1. Customer Places an order.");
    } finally {
      await server.stop();
    }
  }, 30_000);
});

async function createRoundTripUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const projectKey = "RTD";
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: projectKey, name: "Round Trip Dogfood", visibility: "PRIVATE" },
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
      description: "Owns the checkout business outcome.",
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
  const scenario = await postJson<ScenarioResponse>(
    `${apiUrl}/v1/usecases/${usecase.usecase.id}/scenarios`,
    { type: "MAIN_SUCCESS" },
    headers
  );
  await postJson(
    `${apiUrl}/v1/scenarios/${scenario.scenario.id}/steps`,
    { action: "Places an order.", actor: "Customer" },
    headers
  );

  return {
    cookie: signedUp.cookie,
    projectId: project.project.id,
    projectKey,
    usecaseKey: usecase.usecase.key,
    workspaceId: signedUp.workspaceId
  };
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(
    `${apiUrl}/v1/auth/github/start`,
    {
      workspace: {
        name: "CLI Round Trip",
        slug: "cli-round-trip"
      }
    },
    jsonHeaders()
  );
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-roundtrip-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, { headers: { Cookie: start.cookie } });
  const callbackBody = (await callback.json()) as SignupResponse;
  if (!callback.ok) {
    throw new Error(`Signup callback failed with ${String(callback.status)}`);
  }

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: callbackBody.user.id,
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

function tempDir(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(path);
  return path;
}
