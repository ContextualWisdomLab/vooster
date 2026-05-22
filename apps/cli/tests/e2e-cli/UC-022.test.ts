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

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-022 CLI - Lock a use case", () => {
  test("MAIN: agent acquires a semantic use case lock with finite TTL", async () => {
    const server = await startNetworkServer("vspec-cli-uc022-");
    try {
      const setup = await createLockableUseCase(server.apiUrl);
      const result = await runCli([
        "lock",
        setup.usecaseId,
        "--type",
        "semantic",
        "--reason",
        "Agent is rewriting the success scenario.",
        "--ttl",
        "15",
        "--session",
        "session-main-lock",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Lock [a-f0-9-]+/u);
      expect(result.stdout).toContain("Type SEMANTIC");
      expect(result.stdout).toContain(`Target ${setup.usecaseId}`);
      expect(result.stdout).toContain("Holder session-main-lock");
      expect(result.stdout).toContain("Auto release true");
      expect(result.stdout).toContain("Expires at ");
      expect(result.stdout).toMatch(/vspec lock renew [a-f0-9-]+/u);
      expect(result.stdout).toContain(`vspec unlock ${setup.usecaseKey}`);
    } finally {
      await server.stop();
    }
  });
});

async function createLockableUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "LCK", name: "Lock", visibility: "PRIVATE" }),
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
  const useCaseResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/usecases`,
    {
      body: JSON.stringify({
        primary_actor: "Customer",
        title: "Reviews locked refund"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = await useCaseResponse.json() as UseCaseResponse;

  return {
    cookie: signedUp.cookie,
    usecaseId: useCaseBody.usecase.id,
    usecaseKey: useCaseBody.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Lock",
        slug: "cli-lock"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-lock-owner");
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
