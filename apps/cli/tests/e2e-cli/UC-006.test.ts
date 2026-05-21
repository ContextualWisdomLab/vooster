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

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-006 CLI - Define a stakeholder", () => {
  test("MAIN: project member defines a stakeholder with an initial revision", async () => {
    const server = await startNetworkServer("vspec-cli-uc006-");
    try {
      const setup = await createProject(server.apiUrl);
      const result = await runCli([
        "stakeholder",
        "create",
        "--project-id",
        setup.projectId,
        "--name",
        "Product Manager",
        "--type",
        "INTERNAL",
        "--description",
        "Owns the checkout business outcome.",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Product Manager");
      expect(result.stdout).toContain("INTERNAL");
      expect(result.stdout).toContain("version 1");
      expect(result.stdout).toContain("vspec usecase add-stakeholder");
    } finally {
      await server.stop();
    }
  });
});

async function createProject(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const response = await fetch(`${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`, {
    body: JSON.stringify({ key: "STK", name: "Stakeholders", visibility: "PRIVATE" }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  const body = await response.json() as ProjectResponse;

  return {
    cookie: signedUp.cookie,
    projectId: body.project.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Stakeholder",
        slug: "cli-stakeholder"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-stakeholder-owner");
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
