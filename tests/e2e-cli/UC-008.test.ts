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

type GoalResponse = {
  goal: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-008 CLI - Promote a goal to a use case", () => {
  test("MAIN: project member promotes an identified goal", async () => {
    const server = await startNetworkServer("vspec-cli-uc008-");
    try {
      const setup = await createGoal(server.apiUrl);
      const result = await runCli([
        "goal",
        "promote",
        setup.goalId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("UseCase GOL-001");
      expect(result.stdout).toContain("Places an order");
      expect(result.stdout).toContain("BRIEF");
      expect(result.stdout).toContain("version 1");
      expect(result.stdout).toContain("Goal PROMOTED");
      expect(result.stdout).toContain("vspec usecase add-stakeholder");
      expect(result.stdout).toContain("vspec scenario main");
    } finally {
      await server.stop();
    }
  });
});

async function createGoal(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "GOL", name: "Goal Promotion", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const projectBody = await projectResponse.json() as ProjectResponse;
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
  const actorBody = await actorResponse.json() as ActorResponse;
  const goalResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/goals`,
    {
      body: JSON.stringify({
        actor_id: actorBody.actor.id,
        description: "Places an order",
        level: "USER_GOAL",
        priority: "P1"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const goalBody = await goalResponse.json() as GoalResponse;

  return {
    cookie: signedUp.cookie,
    goalId: goalBody.goal.id
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Goal Promotion",
        slug: "cli-goal-promotion"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-goal-promotion-owner");
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
