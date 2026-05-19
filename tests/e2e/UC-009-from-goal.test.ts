import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { createActor, createGoalForActor, createProject } from "../helpers/uc-fixtures.js";

type UseCaseResponse = {
  goal: { linked_usecase_id: string; status: string };
  revision: { change_summary: string; entity_id: string };
  usecase: {
    id: string;
    key: string;
    level: string;
    primary_actor_id: string;
    title: string;
  };
};
type ProblemResponse = {
  title: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-009 - Author a use case from a goal", () => {
  test("3a: from goal delegates to promotion and carries goal fields", async () => {
    const setup = await createProject(server, "Author From Goal", "author-from-goal", "stub-author-from-goal");
    const actor = await createActor(server, setup, "Customer");
    const goal = await createGoalForActor(server, setup, actor, "Requests a refund");

    const response = await postUseCase(setup.projectId, setup.cookie, JSON.stringify({ from_goal_id: goal.id }));

    expect(response.status).toBe(201);
    const body = (await response.json()) as UseCaseResponse;
    expect(body.usecase).toMatchObject({
      key: "CHK-001",
      level: goal.level,
      primary_actor_id: actor.id,
      title: goal.description
    });
    expect(body.revision).toMatchObject({
      change_summary: `Promoted from goal ${goal.id}`,
      entity_id: body.usecase.id
    });
    expect(body.goal).toMatchObject({
      linked_usecase_id: body.usecase.id,
      status: "PROMOTED"
    });
  });

  test("3a: unknown from-goal id returns goal guidance", async () => {
    const setup = await createProject(server, "Missing From Goal", "missing-from-goal", "stub-missing-from-goal");

    const response = await postUseCase(setup.projectId, setup.cookie, JSON.stringify({ from_goal_id: "missing-goal" }));

    expect(response.status).toBe(404);
    const problem = (await response.json()) as ProblemResponse;
    expect(problem.title).toBe("Goal not found");
  });

  test("3a: from-goal id from another project is not visible", async () => {
    const owner = await createProject(server, "Visible From Goal", "visible-from-goal", "stub-visible-from-goal");
    const actor = await createActor(server, owner, "Customer");
    const goal = await createGoalForActor(server, owner, actor, "Requests support");
    const other = await createProject(server, "Hidden From Goal", "hidden-from-goal", "stub-hidden-from-goal");

    const response = await postUseCase(other.projectId, other.cookie, JSON.stringify({ from_goal_id: goal.id }));

    expect(response.status).toBe(404);
    const problem = (await response.json()) as ProblemResponse;
    expect(problem.title).toBe("Goal not found");
  });

  test("3a: malformed from-goal payloads follow raw create validation", async () => {
    const setup = await createProject(server, "Malformed From Goal", "malformed-from-goal", "stub-malformed-from-goal");
    const payloads = [
      JSON.stringify({}),
      JSON.stringify({ from_goal_id: "" }),
      JSON.stringify({ from_goal_id: 42 }),
      "null",
      "42",
      JSON.stringify({ from_goal_id: { length: 1 } })
    ];

    for (const payload of payloads) {
      const response = await postUseCase(setup.projectId, setup.cookie, payload);

      expect(response.status).toBe(400);
      const problem = (await response.json()) as ProblemResponse;
      expect(problem.title).toBe("Invalid use case request");
    }
  });
});

function postUseCase(projectId: string, cookie: string, body: string) {
  return server.fetch(`/v1/projects/${projectId}/usecases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body
  });
}
