import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  createActor,
  createGoalForActor,
  createProject,
  type Goal
} from "../helpers/uc-fixtures.js";

type UseCase = {
  format: string;
  id: string;
  key: string;
  level: string;
  primary_actor_id: string;
  project_id: string;
  status: string;
  title: string;
};
type PromoteResponse = {
  goal: Goal;
  revision: {
    change_summary: string;
    entity_id: string;
    entity_type: string;
    version_number: number;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: UseCase;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-008 - Promote a goal to a use case", () => {
  test("MAIN: promote an identified goal into a seeded use case", async () => {
    const setup = await createProject(server, "Promote Goal", "promote-goal", "stub-promote-goal");
    const actor = await createActor(server, setup, "Customer");
    const goal = await createGoalForActor(server, setup, actor, "Places an order");

    const response = await server.fetch(`/v1/goals/${goal.id}/promote`, {
      method: "POST",
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as PromoteResponse;
    expect(body.usecase).toMatchObject({
      format: "BRIEF",
      key: "CHK-001",
      level: "USER_GOAL",
      primary_actor_id: actor.id,
      project_id: setup.projectId,
      status: "DRAFT",
      title: "Places an order"
    });
    expect(body.revision).toMatchObject({
      change_summary: `Promoted from goal ${goal.id}`,
      entity_id: body.usecase.id,
      entity_type: "USECASE",
      version_number: 1
    });
    expect(body.goal).toMatchObject({
      id: goal.id,
      linked_usecase_id: body.usecase.id,
      status: "PROMOTED"
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase add-stakeholder",
      reason: "Attach stakeholders and interests."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec scenario main",
      reason: "Write the main success scenario."
    });
  });
});
