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

type StepResponse = {
  revision: {
    id: string;
  };
  step: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-013 CLI - Edit a use case step", () => {
  test("MAIN: project member edits a step action with base revision", async () => {
    const server = await startNetworkServer("vspec-cli-uc013-");
    try {
      const setup = await createUseCaseWithMainStep(server.apiUrl);
      const result = await runCli([
        "step",
        "edit",
        setup.stepId,
        "--action",
        "Reviews the order.",
        "--base-revision",
        setup.baseRevision,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Reviews the order.");
      expect(result.stdout).toContain("BREAKING");
      expect(result.stdout).toContain("version 5");
      expect(result.stdout).toContain("Affected sessions none");
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
      body: JSON.stringify({ key: "EDT", name: "Step Edits", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const projectBody = (await projectResponse.json()) as ProjectResponse;
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
  const useCaseBody = (await useCaseResponse.json()) as UseCaseResponse;
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
  const scenarioBody = (await scenarioResponse.json()) as ScenarioResponse;
  const stepResponse = await fetch(
    `${apiUrl}/v1/scenarios/${scenarioBody.scenario.id}/steps`,
    {
      body: JSON.stringify({
        action: "Places an order.",
        actor: "Customer"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const stepBody = (await stepResponse.json()) as StepResponse;

  return {
    baseRevision: stepBody.revision.id,
    cookie: signedUp.cookie,
    stepId: stepBody.step.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Step Edit",
        slug: "cli-step-edit"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-step-edit-owner");
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.headers.get("set-cookie") ?? ""
    }
  });
  const callbackBody = (await callback.json()) as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}
