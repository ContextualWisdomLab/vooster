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
type ProblemResponse = {
  existing_usecase_key?: string;
  title: string;
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

  test("2a: already promoted goal points to existing use case", async () => {
    const setup = await createProject(server, "Promoted Twice", "promoted-twice", "stub-promoted-twice");
    const actor = await createActor(server, setup, "Customer");
    const goal = await createGoalForActor(server, setup, actor, "Requests a refund");
    const first = await server.fetch(`/v1/goals/${goal.id}/promote`, {
      method: "POST",
      headers: { Cookie: setup.cookie }
    });
    const firstBody = (await first.json()) as PromoteResponse;

    const second = await server.fetch(`/v1/goals/${goal.id}/promote`, {
      method: "POST",
      headers: { Cookie: setup.cookie }
    });

    expect(second.status).toBe(409);
    const body = (await second.json()) as ProblemResponse;
    expect(body.title).toMatch(/already promoted/i);
    expect(body.existing_usecase_key).toBe(firstBody.usecase.key);
  });
});
