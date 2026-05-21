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

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-004 CLI - Create a project", () => {
  test("MAIN: workspace member creates a project with main branch", async () => {
    const server = await startNetworkServer("vspec-cli-uc004-");
    try {
      const signedUp = await signup(server.apiUrl);
      const result = await runCli([
        "project",
        "create",
        "--workspace-id",
        signedUp.workspaceId,
        "--name",
        "Payments",
        "--key",
        "PAY",
        "--visibility",
        "INTERNAL",
        "--session-cookie",
        signedUp.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Payments");
      expect(result.stdout).toContain("PAY");
      expect(result.stdout).toContain("main");
      expect(result.stdout).toContain("vspec actor define");
    } finally {
      await server.stop();
    }
  });
});

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Project",
        slug: "cli-project"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-project-owner");
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
