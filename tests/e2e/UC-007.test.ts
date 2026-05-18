import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  createActor,
  createGoal,
  createProject,
  listGoals,
  patchGoal,
  type Actor
} from "../helpers/uc-fixtures.js";

type Goal = {
  actor_id: string;
  archived_at: null;
  description: string;
  id: string;
  level: string;
  linked_usecase_id: null;
  priority: string;
  project_id: string;
  status: string;
};
type GoalResponse = {
  goal: Goal;
  recommended_next_command?: string;
  revision: { entity_id: string; entity_type: string; version_number: number };
};
type GoalListResponse = {
  actors: Array<{ actor: Actor; goals: Goal[] }>;
};
type ProblemResponse = {
  actor_id?: string;
  allowed_status_transitions?: string[];
  description_rule?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-007 - Manage the actor-goal list", () => {
  test("MAIN: create goal and list it grouped by actor", async () => {
    const setup = await createProject(server, "Goal Project", "goal-project", "stub-goal-owner");
    const actor = await createActor(server, setup, "Customer");

    const created = await createGoal(server, setup, {
      actor_id: actor.id,
      description: "Places an order",
      level: "USER_GOAL",
      priority: "P1"
    });

    expect(created.status).toBe(201);
    const body = (await created.json()) as GoalResponse;
    expect(body.goal).toMatchObject({
      actor_id: actor.id,
      archived_at: null,
      description: "Places an order",
      level: "USER_GOAL",
      linked_usecase_id: null,
      priority: "P1",
      project_id: setup.projectId,
      status: "IDENTIFIED"
    });
    expect(body.revision).toMatchObject({
      entity_id: body.goal.id,
      entity_type: "GOAL",
      version_number: 1
    });
    expect(body.recommended_next_command).toBe("vspec goal list");

    const listed = await listGoals(server, setup, actor.id);
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as GoalListResponse;
    expect(listBody.actors).toEqual([
      {
        actor,
        goals: [body.goal]
      }
    ]);
  });

  test("3a: missing actor returns actor selection guidance", async () => {
    const setup = await createProject(
      server,
      "Missing Goal Actor",
      "missing-goal-actor",
      "stub-goal-missing-actor"
    );

    const response = await createGoal(server, setup, {
      actor_id: "missing-actor-id",
      description: "Reviews checkout exceptions",
      level: "USER_GOAL",
      priority: "P2"
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/actor.*not available/i);
    expect(body.actor_id).toBe("missing-actor-id");
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor list",
      reason: "Find a valid actor for this project."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor create",
      reason: "Create the actor before assigning goals."
    });
  });

  test("5a: whitespace description is rejected as not a verb phrase", async () => {
    const setup = await createProject(server, "Blank Goal", "blank-goal", "stub-goal-blank");
    const actor = await createActor(server, setup, "Clerk");

    const response = await createGoal(server, setup, {
      actor_id: actor.id,
      description: "   ",
      level: "USER_GOAL",
      priority: "P2"
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/goal description.*verb phrase/i);
    expect(body.description_rule).toBe("Use a non-empty verb phrase.");
  });

  test("5b: illegal status transition leaves goal unchanged", async () => {
    const setup = await createProject(
      server,
      "Illegal Goal Status",
      "illegal-goal-status",
      "stub-goal-illegal-status"
    );
    const actor = await createActor(server, setup, "Buyer");
    const created = await createGoal(server, setup, {
      actor_id: actor.id,
      description: "Tracks an order",
      level: "USER_GOAL",
      priority: "P1"
    });
    const goal = ((await created.json()) as GoalResponse).goal;

    const response = await patchGoal(server, setup, goal.id, { status: "PROMOTED" });

    expect(response.status).toBe(422);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/illegal status transition/i);
    expect(body.allowed_status_transitions).toEqual([
      "IDENTIFIED -> IN_DESIGN",
      "IN_DESIGN -> PROMOTED",
      "any -> REJECTED"
    ]);

    const listed = await listGoals(server, setup, actor.id);
    const listBody = (await listed.json()) as GoalListResponse;
    expect(listBody.actors[0]?.goals[0]?.status).toBe("IDENTIFIED");
  });

  test("6a: rejecting a promoted goal requires archiving the use case first", async () => {
    const setup = await createProject(server, "Promoted Goal", "promoted-goal", "stub-goal-promoted");
    const actor = await createActor(server, setup, "Subscriber");
    const created = await createGoal(server, setup, {
      actor_id: actor.id,
      description: "Renews a subscription",
      level: "USER_GOAL",
      priority: "P0"
    });
    const goal = ((await created.json()) as GoalResponse).goal;
    const inDesign = await patchGoal(server, setup, goal.id, { status: "IN_DESIGN" });
    expect(inDesign.status).toBe(200);
    const inDesignBody = (await inDesign.json()) as GoalResponse;
    expect(inDesignBody.goal.status).toBe("IN_DESIGN");
    expect(inDesignBody.revision.version_number).toBe(2);
    const promoted = await patchGoal(server, setup, goal.id, { status: "PROMOTED" });
    expect(promoted.status).toBe(200);
    const promotedBody = (await promoted.json()) as GoalResponse;
    expect(promotedBody.goal.status).toBe("PROMOTED");
    expect(promotedBody.revision.version_number).toBe(3);
    const rejected = await patchGoal(server, setup, goal.id, { status: "REJECTED" });
    expect(rejected.status).toBe(422);
    const body = (await rejected.json()) as ProblemResponse;
    expect(body.title).toMatch(/use case.*archive/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase archive",
      reason: "Deprecate the linked use case before rejecting the goal."
    });
    const listBody = (await (await listGoals(server, setup, actor.id)).json()) as GoalListResponse;
    expect(listBody.actors[0]?.goals[0]?.status).toBe("PROMOTED");
  });
});
