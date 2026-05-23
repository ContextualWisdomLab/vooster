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

describe("UC-019 CLI - Create a branch", () => {
  test("MAIN: project editor creates a human branch from main", async () => {
    const server = await startNetworkServer("vspec-cli-uc019-");
    try {
      const setup = await createBranchReadyProject(server.apiUrl);
      const result = await runCli([
        "branch",
        "create",
        "feature/refund-review",
        "--from",
        "main",
        "--project-id",
        setup.projectId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Branch [a-f0-9-]+/u);
      expect(result.stdout).toContain("Name feature/refund-review");
      expect(result.stdout).toContain("Status ACTIVE");
      expect(result.stdout).toContain("Owner HUMAN");
      expect(result.stdout).toContain("Base revisions 1");
      expect(result.stdout).toContain("Head revisions 1");
      expect(result.stdout).toContain("vspec branch checkout feature/refund-review");
      expect(result.stdout).toContain(`vspec usecase edit ${setup.usecaseKey}`);
    } finally {
      await server.stop();
    }
  });
});

async function createBranchReadyProject(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({
        key: "BRC",
        name: "Branch Create",
        visibility: "PRIVATE"
      }),
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
        title: "Reviews branchable refund"
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
        name: "CLI Branch",
        slug: "cli-branch"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-branch-owner");
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
