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

describe("UC-007 CLI - Manage the actor-goal list", () => {
  test("MAIN: project member creates and lists a goal grouped by actor", async () => {
    const server = await startNetworkServer("vspec-cli-uc007-");
    try {
      const setup = await createProjectWithActor(server.apiUrl);
      const created = await runCli([
        "goal",
        "create",
        "--project-id",
        setup.projectId,
        "--actor-id",
        setup.actorId,
        "--description",
        "Places an order",
        "--level",
        "USER_GOAL",
        "--priority",
        "P1",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(created.stderr).toBe("");
      expect(created.status).toBe(0);
      expect(created.stdout).toContain("Places an order");
      expect(created.stdout).toContain("IDENTIFIED");
      expect(created.stdout).toContain("P1");
      expect(created.stdout).toContain("version 1");
      expect(created.stdout).toContain("vspec goal list");

      const listed = await runCli([
        "goal",
        "list",
        "--project-id",
        setup.projectId,
        "--actor-id",
        setup.actorId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(listed.stderr).toBe("");
      expect(listed.status).toBe(0);
      expect(listed.stdout).toContain("Customer");
      expect(listed.stdout).toContain("Places an order");
      expect(listed.stdout).toContain("IDENTIFIED");
      expect(listed.stdout).toContain("P1");
    } finally {
      await server.stop();
    }
  });

  test("MAIN: member creates a goal by actor name with --actor", async () => {
    const server = await startNetworkServer("vspec-cli-uc007-name-");
    try {
      const setup = await createProjectWithActor(server.apiUrl);
      const created = await runCli([
        "goal",
        "create",
        "--project-id",
        setup.projectId,
        "--actor",
        "Customer",
        "--description",
        "Places an order",
        "--level",
        "USER_GOAL",
        "--priority",
        "P1",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(created.stderr).toBe("");
      expect(created.status).toBe(0);
      expect(created.stdout).toContain("Places an order");
      expect(created.stdout).toContain("IDENTIFIED");
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
      body: JSON.stringify({ key: "GOL", name: "Goals", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const projectBody = (await projectResponse.json()) as ProjectResponse;
  const actorResponse = await fetch(
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
  const actorBody = (await actorResponse.json()) as ActorResponse;

  return {
    actorId: actorBody.actor.id,
    cookie: signedUp.cookie,
    projectId: projectBody.project.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Goal",
        slug: "cli-goal"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-goal-owner");
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
