import type { TestServer } from "./server.js";

export type Actor = { id: string; name: string; project_id: string };
export type Goal = {
  actor_id: string;
  archived_at: null;
  description: string;
  id: string;
  level: string;
  linked_usecase_id: null | string;
  priority: string;
  project_id: string;
  status: string;
};
export type GoalResponse = {
  goal: Goal;
  recommended_next_command?: string;
  revision: { entity_id: string; entity_type: string; version_number: number };
  warnings?: Array<{ candidate_goal_id: string; command: string; type: string }>;
};
export type GoalListResponse = {
  actors: Array<{ actor: Actor; goals: Goal[] }>;
};
export type ProblemResponse = {
  actor_id?: string;
  allowed_status_transitions?: string[];
  description_rule?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
export type ProjectSetup = {
  cookie: string;
  projectId: string;
  userId: string;
  workspaceId: string;
};

type ActorResponse = { actor: Actor };
type ProjectResponse = { project: { id: string } };

export async function createProject(
  server: TestServer,
  name: string,
  slug: string,
  code: string
): Promise<ProjectSetup> {
  const signedUp = await signup(server, name, slug, code);
  const response = await server.fetch(`/v1/workspaces/${signedUp.workspaceId}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: signedUp.cookie },
    body: JSON.stringify({ name: "Checkout", key: "CHK", visibility: "PRIVATE" })
  });
  const body = (await response.json()) as ProjectResponse;
  return { ...signedUp, projectId: body.project.id };
}

export async function createActor(
  server: TestServer,
  setup: ProjectSetup,
  name: string
): Promise<Actor> {
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

export async function createGoal(
  server: TestServer,
  setup: ProjectSetup,
  body: { actor_id: string; description: string; level: string; priority: string }
) {
  return server.fetch(`/v1/projects/${setup.projectId}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify(body)
  });
}

export async function createGoalForActor(
  server: TestServer,
  setup: ProjectSetup,
  actor: Actor,
  description: string,
  priority = "P1"
): Promise<Goal> {
  const response = await createGoal(server, setup, {
    actor_id: actor.id,
    description,
    level: "USER_GOAL",
    priority
  });
  return ((await response.json()) as GoalResponse).goal;
}

export async function patchGoal(
  server: TestServer,
  setup: { cookie: string },
  goalId: string,
  body: { status: string }
) {
  return server.fetch(`/v1/goals/${goalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify(body)
  });
}

export async function listGoals(
  server: TestServer,
  setup: ProjectSetup,
  actorId: string
) {
  return server.fetch(`/v1/projects/${setup.projectId}/goals?actor_id=${actorId}`, {
    headers: { Cookie: setup.cookie }
  });
}

async function signup(server: TestServer, name: string, slug: string, code: string) {
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
