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

describe("UC-009 CLI - Author a use case from scratch", () => {
  test("MAIN: project member creates a draft use case with defaults", async () => {
    const server = await startNetworkServer("vspec-cli-uc009-");
    try {
      const setup = await createProjectWithActor(server.apiUrl);
      const result = await runCli([
        "usecase",
        "create",
        "--project-id",
        setup.projectId,
        "--title",
        "Places an order",
        "--primary-actor",
        "Customer",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("UseCase USC-001");
      expect(result.stdout).toContain("Places an order");
      expect(result.stdout).toContain("USER_GOAL");
      expect(result.stdout).toContain("BRIEF");
      expect(result.stdout).toContain("DRAFT");
      expect(result.stdout).toContain("P2");
      expect(result.stdout).toContain("version 1");
      expect(result.stdout).toContain("vspec usecase show USC-001");
      expect(result.stdout).toContain("vspec usecase add-stakeholder");
      expect(result.stdout).toContain("vspec scenario add");
    } finally {
      await server.stop();
    }
  });
});

async function createProjectWithActor(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "USC", name: "Use Cases", visibility: "PRIVATE" }),
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

  return {
    cookie: signedUp.cookie,
    projectId: projectBody.project.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Use Case",
        slug: "cli-usecase"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-usecase-owner");
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
