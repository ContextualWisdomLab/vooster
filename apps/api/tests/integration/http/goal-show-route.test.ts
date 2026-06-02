import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createGoalForActor,
  createProject,
  type ProjectSetup
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("GET /v1/goals/:goalId integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("returns not found when the goal does not exist through real routing", async () => {
    const response = await server.fetch("/v1/goals/goal-1");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Goal not found" });
  });

  test("returns the goal for an authenticated project member through real routing", async () => {
    const setup = await seedGoal(server, "Goal Show Member", "goal-show-member");

    const response = await server.fetch(`/v1/goals/${setup.goalId}`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      goal: { description: string; id: string; level: string };
      recommended_next_command: string;
    };
    expect(body.goal.id).toBe(setup.goalId);
    expect(body.goal.description).toBe("Buyer can place an order");
    expect(body.recommended_next_command).toBe("vspec goal list");
  });

  test("rejects anonymous access to a stored goal through real routing", async () => {
    const setup = await seedGoal(server, "Goal Show Anon", "goal-show-anon");

    const response = await server.fetch(`/v1/goals/${setup.goalId}`);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      title: "Contact the workspace owner for access"
    });
  });

  test("rejects non-members from accessing a stored goal through real routing", async () => {
    const owner = await seedGoal(server, "Goal Show Owner", "goal-show-owner");
    const outsider = await createProject(
      server,
      "Goal Show Outsider",
      "goal-show-outsider",
      "goal-show-outsider"
    );

    const response = await server.fetch(`/v1/goals/${owner.goalId}`, {
      headers: { Cookie: outsider.cookie }
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      title: "Contact the workspace owner for access"
    });
  });
});

async function seedGoal(
  testServer: TestServer,
  name: string,
  slug: string
): Promise<ProjectSetup & { goalId: string }> {
  const setup = await createProject(testServer, name, slug, slug);
  const actor = await createActor(testServer, setup, "Customer");
  const goal = await createGoalForActor(
    testServer,
    setup,
    actor,
    "Buyer can place an order"
  );
  return { ...setup, goalId: goal.id };
}
