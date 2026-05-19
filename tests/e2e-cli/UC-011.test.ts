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
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-011 CLI - Write the main success scenario", () => {
  test("MAIN: project member creates the main scenario and appends a step", async () => {
    const server = await startNetworkServer("vspec-cli-uc011-");
    try {
      const setup = await createScenarioReadyUseCase(server.apiUrl);
      const scenario = await runCli([
        "scenario",
        "add",
        setup.usecaseId,
        "--type",
        "main-success",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(scenario.stderr).toBe("");
      expect(scenario.status).toBe(0);
      expect(scenario.stdout).toContain("MAIN_SUCCESS");
      expect(scenario.stdout).toContain("SUCCESS");
      expect(scenario.stdout).toContain("version 3");
      const scenarioId = scenario.stdout.match(/Scenario ([a-f0-9-]+)/)?.[1];
      expect(scenarioId).toBeDefined();

      const step = await runCli([
        "step",
        "add",
        scenarioId ?? "",
        "--actor",
        "Customer",
        "--action",
        "Places an order.",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(step.stderr).toBe("");
      expect(step.status).toBe(0);
      expect(step.stdout).toContain("1. Customer Places an order.");
      expect(step.stdout).toContain("version 4");
    } finally {
      await server.stop();
    }
  });
});

async function createScenarioReadyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "SCN", name: "Scenarios", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
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
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/stakeholders`, {
    body: JSON.stringify({
      description: "Owns checkout revenue.",
      name: "Product Manager",
      type: "INTERNAL"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  const useCaseResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/usecases`,
    {
      body: JSON.stringify({
        primary_actor: "Customer",
        title: "Places an order"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = await useCaseResponse.json() as UseCaseResponse;
  await fetch(`${apiUrl}/v1/usecases/${useCaseBody.usecase.id}/stakeholder-interests`, {
    body: JSON.stringify({
      interest: "Checkout revenue is protected.",
      protection_mechanism: "Success guarantee",
      stakeholder: "Product Manager"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });

  return {
    cookie: signedUp.cookie,
    usecaseId: useCaseBody.usecase.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Scenario",
        slug: "cli-scenario"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-scenario-owner");
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
