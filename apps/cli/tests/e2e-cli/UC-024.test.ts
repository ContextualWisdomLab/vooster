import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = {
  workspace: {
    id: string;
  };
};

type OAuthStartResponse = {
  state: string;
};

type ProjectResponse = {
  project: {
    id: string;
  };
};

type UseCaseResponse = {
  usecase: {
    id: string;
    key: string;
  };
};

type ScenarioResponse = {
  scenario: {
    id: string;
  };
};

type StepResponse = {
  revision: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-024 CLI - View revision history", () => {
  test("MAIN: project member lists newest use case revisions and next actions", async () => {
    const server = await startNetworkServer("vspec-cli-uc024-");
    try {
      const setup = await createUseCaseWithHistory(server.apiUrl);
      const result = await runCli([
        "history",
        setup.usecaseId,
        "--limit",
        "4",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`UseCase ${setup.usecaseKey}`);
      expect(result.stdout).toContain("Limit 4");
      expect(result.stdout).toContain("Truncated false");
      expect(result.stdout).toContain("Suppressed 0");
      expect(result.stdout).toContain(`Revision ${setup.latestRevisionId}`);
      expect(result.stdout).toContain("Version 4");
      expect(result.stdout).toContain(`Entity USECASE ${setup.usecaseId}`);
      expect(result.stdout).toContain("Added step 1 to main success scenario");
      expect(result.stdout).toContain(
        `vspec usecase show ${setup.usecaseKey} --revision=${setup.latestRevisionId}`
      );
      expect(result.stdout).toContain("vspec diff");
    } finally {
      await server.stop();
    }
  });
});

async function createUseCaseWithHistory(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "HST", name: "History", visibility: "PRIVATE" }),
      headers,
      method: "POST"
    }
  );
  const projectBody = await projectResponse.json() as ProjectResponse;
  await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/actors`, {
    body: JSON.stringify({
      aliases: ["Buyer"],
      description: "Person buying a product.",
      is_human: true,
      name: "Customer",
      type: "PRIMARY"
    }),
    headers,
    method: "POST"
  });
  await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/stakeholders`, {
    body: JSON.stringify({
      description: "Owns checkout revenue.",
      name: "Product Manager",
      type: "INTERNAL"
    }),
    headers,
    method: "POST"
  });
  const useCaseResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/usecases`,
    {
      body: JSON.stringify({
        primary_actor: "Customer",
        title: "Reviews order history"
      }),
      headers,
      method: "POST"
    }
  );
  const useCaseBody = await useCaseResponse.json() as UseCaseResponse;
  await fetch(`${apiUrl}/v1/usecases/${useCaseBody.usecase.id}/stakeholder-interests`, {
    body: JSON.stringify({
      interest: "Order audit trail stays clear.",
      protection_mechanism: "Success guarantee",
      stakeholder: "Product Manager"
    }),
    headers,
    method: "POST"
  });
  const scenarioResponse = await fetch(
    `${apiUrl}/v1/usecases/${useCaseBody.usecase.id}/scenarios`,
    {
      body: JSON.stringify({ type: "MAIN_SUCCESS" }),
      headers,
      method: "POST"
    }
  );
  const scenarioBody = await scenarioResponse.json() as ScenarioResponse;
  const stepResponse = await fetch(`${apiUrl}/v1/scenarios/${scenarioBody.scenario.id}/steps`, {
    body: JSON.stringify({
      action: "Reviews order status.",
      actor: "Customer"
    }),
    headers,
    method: "POST"
  });
  const stepBody = await stepResponse.json() as StepResponse;

  return {
    cookie: signedUp.cookie,
    latestRevisionId: stepBody.revision.id,
    usecaseId: useCaseBody.usecase.id,
    usecaseKey: useCaseBody.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI History",
        slug: "cli-history"
      }
    }),
    headers: jsonHeaders(),
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-history-owner");
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.headers.get("set-cookie") ?? ""
    }
  });
  const callbackBody = await callback.json() as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}

function jsonHeaders(cookie?: string): Record<string, string> {
  return cookie === undefined
    ? { "Content-Type": "application/json" }
    : { "Content-Type": "application/json", Cookie: cookie };
}
