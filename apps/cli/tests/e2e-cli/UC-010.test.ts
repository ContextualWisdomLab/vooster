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

describe("UC-010 CLI - Define stakeholder interests", () => {
  test("MAIN: project member adds stakeholder interest to a use case", async () => {
    const server = await startNetworkServer("vspec-cli-uc010-");
    try {
      const setup = await createUseCaseWithStakeholder(server.apiUrl);
      const result = await runCli([
        "usecase",
        "add-stakeholder",
        setup.usecaseId,
        "--stakeholder",
        "Product Manager",
        "--interest",
        "Checkout revenue is protected.",
        "--protection-mechanism",
        "Success guarantee",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Product Manager");
      expect(result.stdout).toContain("Checkout revenue is protected.");
      expect(result.stdout).toContain("Success guarantee");
      expect(result.stdout).toContain("NON_BREAKING");
      expect(result.stdout).toContain("version 2");
      expect(result.stdout).toContain("No regulatory stakeholder yet.");
    } finally {
      await server.stop();
    }
  });
});

async function createUseCaseWithStakeholder(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "INT", name: "Interests", visibility: "PRIVATE" }),
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

  return {
    cookie: signedUp.cookie,
    usecaseId: useCaseBody.usecase.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Interest",
        slug: "cli-interest"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-interest-owner");
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
