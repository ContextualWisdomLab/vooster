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

describe("UC-015 CLI - Archive or restore a use case", () => {
  test("MAIN: project member archives a use case and hides it from default list", async () => {
    const server = await startNetworkServer("vspec-cli-uc015-");
    try {
      const setup = await createUseCase(server.apiUrl);
      const archived = await runCli([
        "usecase",
        "archive",
        setup.usecaseId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(archived.stderr).toBe("");
      expect(archived.status).toBe(0);
      expect(archived.stdout).toContain(`UseCase ${setup.usecaseKey}`);
      expect(archived.stdout).toContain("Archived at ");
      expect(archived.stdout).toContain(`Archived use case ${setup.usecaseKey}`);
      expect(archived.stdout).toContain("Affected sessions 0");
      expect(archived.stdout).toContain("Active locks 0");
      expect(archived.stdout).toContain(`vspec usecase restore ${setup.usecaseKey}`);

      const listed = await runCli([
        "usecase",
        "list",
        "--project-id",
        setup.projectId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(listed.stderr).toBe("");
      expect(listed.status).toBe(0);
      expect(listed.stdout).not.toContain(setup.usecaseKey);
    } finally {
      await server.stop();
    }
  });
});

async function createUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "ARC", name: "Archive", visibility: "PRIVATE" }),
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
        title: "Reviews archived scope"
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
    projectId: projectBody.project.id,
    usecaseId: useCaseBody.usecase.id,
    usecaseKey: useCaseBody.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Archive",
        slug: "cli-archive"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-archive-owner");
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
