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

describe("UC-005 CLI - Define an actor", () => {
  test("MAIN: project member defines an actor with an initial revision", async () => {
    const server = await startNetworkServer("vspec-cli-uc005-");
    try {
      const setup = await createProject(server.apiUrl);
      const result = await runCli([
        "actor",
        "create",
        "--project-id",
        setup.projectId,
        "--name",
        "Customer",
        "--type",
        "PRIMARY",
        "--description",
        "Person buying a product.",
        "--aliases",
        "Buyer,Shopper",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Customer");
      expect(result.stdout).toContain("PRIMARY");
      expect(result.stdout).toContain("version 1");
      expect(result.stdout).toContain("vspec stakeholder create");
    } finally {
      await server.stop();
    }
  });
});

async function createProject(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const response = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "ACT", name: "Actors", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const body = (await response.json()) as ProjectResponse;

  return {
    cookie: signedUp.cookie,
    projectId: body.project.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Actor",
        slug: "cli-actor"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-actor-owner");
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
