import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type Actor = { id: string; name: string; project_id: string };
type ActorResponse = { actor: Actor };
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
  recommended_next_command: string;
  revision: { entity_id: string; entity_type: string; version_number: number };
};
type GoalListResponse = {
  actors: Array<{ actor: Actor; goals: Goal[] }>;
};
type ProjectResponse = { project: { id: string } };

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-007 - Manage the actor-goal list", () => {
  test("MAIN: create goal and list it grouped by actor", async () => {
    const setup = await createProject("Goal Project", "goal-project", "stub-goal-owner");
    const actor = await createActor(setup, "Customer");

    const created = await createGoal(setup, {
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

    const listed = await server.fetch(
      `/v1/projects/${setup.projectId}/goals?actor_id=${actor.id}`,
      { headers: { Cookie: setup.cookie } }
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as GoalListResponse;
    expect(listBody.actors).toEqual([
      {
        actor,
        goals: [body.goal]
      }
    ]);
  });
});

async function createGoal(
  setup: { cookie: string; projectId: string },
  body: { actor_id: string; description: string; level: string; priority: string }
) {
  return server.fetch(`/v1/projects/${setup.projectId}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify(body)
  });
}

async function createActor(setup: { cookie: string; projectId: string }, name: string) {
  const response = await server.fetch(`/v1/projects/${setup.projectId}/actors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({
      aliases: [],
      description: "",
      is_human: true,
      name,
      type: "PRIMARY"
    })
  });
  const body = (await response.json()) as ActorResponse;
  return body.actor;
}

async function createProject(name: string, slug: string, code: string) {
  const signedUp = await signup(name, slug, code);
  const response = await server.fetch(`/v1/workspaces/${signedUp.workspaceId}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: signedUp.cookie },
    body: JSON.stringify({ name: "Checkout", key: "CHK", visibility: "PRIVATE" })
  });
  const body = (await response.json()) as ProjectResponse;
  return { ...signedUp, projectId: body.project.id };
}

async function signup(name: string, slug: string, code: string) {
  const start = await server.fetch("/v1/auth/github/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: { name, slug } })
  });
  const startBody = (await start.json()) as { state: string };
  const params = new URLSearchParams({ code, state: startBody.state });
  const callback = await server.fetch(`/v1/auth/github/callback?${params.toString()}`, {
    headers: { Cookie: start.headers.get("set-cookie") ?? "" }
  });
  const body = (await callback.json()) as { user: { id: string }; workspace: { id: string } };
  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: body.user.id,
    workspaceId: body.workspace.id
  };
}
