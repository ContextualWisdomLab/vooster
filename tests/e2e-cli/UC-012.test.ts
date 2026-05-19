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

type ScenarioResponse = {
  scenario: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-012 CLI - Add an extension flow", () => {
  test("MAIN: project member adds an extension scenario and substep", async () => {
    const server = await startNetworkServer("vspec-cli-uc012-");
    try {
      const setup = await createUseCaseWithMainStep(server.apiUrl);
      const extension = await runCli([
        "scenario",
        "add",
        setup.usecaseId,
        "--type",
        "extension",
        "--at",
        "1a",
        "--condition",
        "Payment is declined.",
        "--outcome",
        "failure",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(extension.stderr).toBe("");
      expect(extension.status).toBe(0);
      expect(extension.stdout).toContain("EXTENSION");
      expect(extension.stdout).toContain("1a");
      expect(extension.stdout).toContain("Payment is declined.");
      expect(extension.stdout).toContain("FAILURE");
      expect(extension.stdout).toContain("version 5");
      const extensionId = extension.stdout.match(/Scenario ([a-f0-9-]+)/)?.[1];
      expect(extensionId).toBeDefined();

      const substep = await runCli([
        "step",
        "add",
        extensionId ?? "",
        "--actor",
        "Customer",
        "--action",
        "Shows payment error.",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(substep.stderr).toBe("");
      expect(substep.status).toBe(0);
      expect(substep.stdout).toContain("1. Customer Shows payment error.");
      expect(substep.stdout).toContain("version 6");
    } finally {
      await server.stop();
    }
  });
});

async function createUseCaseWithMainStep(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "EXT", name: "Extensions", visibility: "PRIVATE" }),
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
  const scenarioResponse = await fetch(
    `${apiUrl}/v1/usecases/${useCaseBody.usecase.id}/scenarios`,
    {
      body: JSON.stringify({ type: "MAIN_SUCCESS" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const scenarioBody = await scenarioResponse.json() as ScenarioResponse;
  await fetch(`${apiUrl}/v1/scenarios/${scenarioBody.scenario.id}/steps`, {
    body: JSON.stringify({
      action: "Places an order.",
      actor: "Customer"
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
        name: "CLI Extension",
        slug: "cli-extension"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-extension-owner");
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
