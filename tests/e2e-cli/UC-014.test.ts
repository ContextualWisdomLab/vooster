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

type ActorResponse = {
  actor: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-014 CLI - Search and filter use cases", () => {
  test("MAIN: project member lists filtered use case previews with cursor", async () => {
    const server = await startNetworkServer("vspec-cli-uc014-");
    try {
      const setup = await createSearchCatalog(server.apiUrl);
      const result = await runCli([
        "usecase",
        "list",
        "--project-id",
        setup.projectId,
        "--actor-id",
        setup.actorId,
        "--q",
        "Reviews",
        "--status",
        "DRAFT",
        "--level",
        "USER_GOAL",
        "--limit",
        "1",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SRC-001");
      expect(result.stdout).toContain("Reviews a refund");
      expect(result.stdout).toContain("Customer");
      expect(result.stdout).toContain("DRAFT");
      expect(result.stdout).toContain("USER_GOAL");
      expect(result.stdout).toContain("Next cursor ");
    } finally {
      await server.stop();
    }
  });
});

async function createSearchCatalog(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "SRC", name: "Search", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const projectBody = await projectResponse.json() as ProjectResponse;
  const customerResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/actors`,
    {
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
    }
  );
  const customerBody = await customerResponse.json() as ActorResponse;
  await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/actors`, {
    body: JSON.stringify({
      aliases: [],
      description: "Internal admin.",
      is_human: true,
      name: "Admin",
      type: "SUPPORTING"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  await createUseCase(apiUrl, projectBody.project.id, signedUp.cookie, {
    primary_actor: "Customer",
    title: "Reviews a refund"
  });
  await createUseCase(apiUrl, projectBody.project.id, signedUp.cookie, {
    primary_actor: "Customer",
    title: "Reviews an invoice"
  });
  await createUseCase(apiUrl, projectBody.project.id, signedUp.cookie, {
    primary_actor: "Admin",
    title: "Reviews an admin report"
  });

  return {
    actorId: customerBody.actor.id,
    cookie: signedUp.cookie,
    projectId: projectBody.project.id
  };
}

async function createUseCase(
  apiUrl: string,
  projectId: string,
  cookie: string,
  body: { primary_actor: string; title: string }
) {
  await fetch(`${apiUrl}/v1/projects/${projectId}/usecases`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    method: "POST"
  });
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Search",
        slug: "cli-search"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-search-owner");
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
