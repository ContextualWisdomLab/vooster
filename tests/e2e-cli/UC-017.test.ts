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

type SessionStartResponse = {
  session: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-017 CLI - Monitor active sessions", () => {
  test("MAIN: workspace member lists active sessions with derived fields", async () => {
    const server = await startNetworkServer("vspec-cli-uc017-");
    try {
      const setup = await createActiveSession(server.apiUrl);
      const result = await runCli([
        "session",
        "list",
        "--workspace-id",
        setup.workspaceId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Total sessions 1");
      expect(result.stdout).toContain("Total conflicts 0");
      expect(result.stdout).toContain(`Session ${setup.sessionId}`);
      expect(result.stdout).toContain("Status ACTIVE");
      expect(result.stdout).toContain("Agent CODEX codex-cli");
      expect(result.stdout).toContain("Intent Monitor active checkout work");
      expect(result.stdout).toContain(`Pins ${setup.usecaseKey}`);
      expect(result.stdout).toContain("Branch agent/monitor-session");
      expect(result.stdout).toMatch(/Idle seconds \d+/u);
      expect(result.stdout).toContain("Locks 0");
      expect(result.stdout).toContain("Conflicts 0");
    } finally {
      await server.stop();
    }
  });
});

async function createActiveSession(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "MON", name: "Monitor", visibility: "PRIVATE" }),
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
        title: "Reviews monitored checkout"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = await useCaseResponse.json() as UseCaseResponse;
  const sessionResponse = await fetch(`${apiUrl}/v1/sessions`, {
    body: JSON.stringify({
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/monitor-session",
      intent: "Monitor active checkout work",
      pins: [useCaseBody.usecase.key],
      project_id: projectBody.project.id
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie,
      "X-Vspec-Agent": "codex-cli"
    },
    method: "POST"
  });
  const sessionBody = await sessionResponse.json() as SessionStartResponse;

  return {
    cookie: signedUp.cookie,
    sessionId: sessionBody.session.id,
    usecaseKey: useCaseBody.usecase.key,
    workspaceId: signedUp.workspaceId
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Monitor",
        slug: "cli-monitor"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-monitor-owner");
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
