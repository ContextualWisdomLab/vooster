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
    key: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-016 CLI - Start a work session", () => {
  test("MAIN: project member starts a session pinned to a use case", async () => {
    const server = await startNetworkServer("vspec-cli-uc016-");
    try {
      const setup = await createSessionReadyUseCase(server.apiUrl);
      const result = await runCli([
        "session",
        "start",
        "--intent",
        "Implement checkout validation",
        "--pin",
        setup.usecaseKey,
        "--agent-type",
        "CODEX",
        "--project-id",
        setup.projectId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Session [a-f0-9-]+/u);
      expect(result.stdout).toContain("Intent Implement checkout validation");
      expect(result.stdout).toContain("Agent CODEX codex-cli");
      expect(result.stdout).toContain("Pinned revisions 1");
      expect(result.stdout).toContain("Session file .vspec/session.json");
      expect(result.stdout).toContain(
        `vspec usecase show ${setup.usecaseKey} --session`
      );
      expect(result.stdout).toContain("vspec session complete");
    } finally {
      await server.stop();
    }
  });
});

async function createSessionReadyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "SES", name: "Sessions", visibility: "PRIVATE" }),
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
  const useCaseResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/usecases`,
    {
      body: JSON.stringify({
        primary_actor: "Customer",
        title: "Reviews checkout validation"
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
    projectId: projectBody.project.id,
    usecaseKey: useCaseBody.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Sessions",
        slug: "cli-sessions"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-session-owner");
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
