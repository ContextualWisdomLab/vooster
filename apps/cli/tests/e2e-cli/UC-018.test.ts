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

type SessionStartResponse = {
  session: {
    id: string;
  };
};

type LockResponse = {
  lock: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-018 CLI - Complete a work session", () => {
  test("MAIN: agent completes a branch session, releases locks, and opens a merge request", async () => {
    const server = await startNetworkServer("vspec-cli-uc018-");
    try {
      const setup = await createCompletableSession(server.apiUrl);
      const result = await runCli([
        "session",
        "complete",
        setup.sessionId,
        "--summary",
        "Finished implementation.",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`Session ${setup.sessionId}`);
      expect(result.stdout).toContain("Status COMPLETED");
      expect(result.stdout).toContain("Ended at ");
      expect(result.stdout).toContain(`Released locks ${setup.lockId}`);
      expect(result.stdout).toMatch(/Merge request [a-f0-9-]+/u);
      expect(result.stdout).toContain("Merge status OPEN");
      expect(result.stdout).toContain("Strategy FAST_FORWARD");
      expect(result.stdout).toContain("Conflicts 0");
      expect(result.stdout).toContain("Session file .vspec/session.json cleared");
      expect(result.stdout).toContain("vspec merge show");
    } finally {
      await server.stop();
    }
  });
});

async function createCompletableSession(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "CMP", name: "Complete", visibility: "PRIVATE" }),
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
        title: "Reviews completed checkout"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = (await useCaseResponse.json()) as UseCaseResponse;
  const sessionResponse = await fetch(`${apiUrl}/v1/sessions`, {
    body: JSON.stringify({
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/complete-session",
      intent: "Complete active checkout work",
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
  const sessionBody = (await sessionResponse.json()) as SessionStartResponse;
  const lockResponse = await fetch(`${apiUrl}/v1/locks`, {
    body: JSON.stringify({
      lock_type: "SEMANTIC",
      reason: "Session owns semantic edits.",
      target_id: useCaseBody.usecase.id,
      target_type: "USECASE"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie,
      "X-Vspec-Session": sessionBody.session.id
    },
    method: "POST"
  });
  const lockBody = (await lockResponse.json()) as LockResponse;

  return {
    cookie: signedUp.cookie,
    lockId: lockBody.lock.id,
    sessionId: sessionBody.session.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Complete",
        slug: "cli-complete"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-complete-owner");
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
