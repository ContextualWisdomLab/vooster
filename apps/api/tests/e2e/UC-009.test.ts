import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { createActor, createProject } from "../helpers/uc-fixtures.js";

type UseCase = {
  current_revision_id: string;
  format: string;
  id: string;
  key: string;
  level: string;
  primary_actor_id: string;
  priority: string;
  project_id: string;
  scope: string;
  status: string;
  title: string;
};
type UseCaseResponse = {
  revision: {
    entity_id: string;
    entity_type: string;
    id: string;
    version_number: number;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: UseCase;
};
type ProblemResponse = {
  actor_name?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  suggested_titles?: string[];
  title: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-009 - Author a use case from scratch", () => {
  test("MAIN: create a draft use case with defaults and first revision", async () => {
    const setup = await createProject(
      server,
      "Author UseCase",
      "author-usecase",
      "stub-author-usecase"
    );
    const actor = await createActor(server, setup, "Customer");

    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "Places an order" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as UseCaseResponse;
    expect(body.usecase).toMatchObject({
      format: "BRIEF",
      key: "CHK-001",
      level: "USER_GOAL",
      primary_actor_id: actor.id,
      priority: "P2",
      project_id: setup.projectId,
      scope: "chk",
      status: "DRAFT",
      title: "Places an order"
    });
    expect(body.usecase.current_revision_id).toBe(body.revision.id);
    expect(body.revision).toMatchObject({
      entity_id: body.usecase.id,
      entity_type: "USECASE",
      version_number: 1
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${body.usecase.key}`,
      reason: "Open the new use case."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase add-stakeholder",
      reason: "Attach stakeholders and interests."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec scenario add",
      reason: "Write the main success scenario."
    });
  });

  test("MAIN: create a Korean draft use case title without force", async () => {
    const setup = await createProject(
      server,
      "Korean Author UseCase",
      "korean-author-usecase",
      "stub-korean-author-usecase"
    );
    const actor = await createActor(server, setup, "Customer");

    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "주문을 생성한다" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as UseCaseResponse;
    expect(body.usecase).toMatchObject({
      key: "CHK-001",
      primary_actor_id: actor.id,
      title: "주문을 생성한다"
    });
  });

  test("2a: non-verb title requires force override", async () => {
    const setup = await createProject(
      server,
      "Weak UseCase",
      "weak-usecase",
      "stub-weak-usecase"
    );
    await createActor(server, setup, "Customer");

    const rejected = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "Order status" })
    });

    expect(rejected.status).toBe(422);
    const problem = (await rejected.json()) as ProblemResponse;
    expect(problem.title).toMatch(/title.*verb phrase/i);
    expect(problem.suggested_titles).toContain("Review order status");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec usecase create --force",
      reason: "Create anyway after reviewing the title."
    });

    const forced = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        force: true,
        primary_actor: "Customer",
        title: "Order status"
      })
    });
    expect(forced.status).toBe(201);
  });

  test("3b: unknown primary actor returns actor guidance", async () => {
    const setup = await createProject(
      server,
      "Unknown Actor",
      "unknown-actor",
      "stub-unknown-actor"
    );

    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "Places an order" })
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/primary actor.*not available/i);
    expect(body.actor_name).toBe("Customer");
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor list",
      reason: "Find a valid actor for this project."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor create --name Customer",
      reason: "Create the actor before authoring the use case."
    });
  });

  test("5c: key collision retries with next available key", async () => {
    const setup = await createProject(
      server,
      "Collision UseCase",
      "collision-usecase",
      "stub-collision-usecase"
    );
    await createActor(server, setup, "Customer");

    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        primary_actor: "Customer",
        simulate_key_collision_once: true,
        title: "Places an order"
      })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as UseCaseResponse;
    expect(body.usecase.key).toBe("CHK-002");
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase show CHK-002",
      reason: "Open the new use case."
    });
  });

  test("*a: unauthorized requester gets access guidance without consuming key", async () => {
    const owner = await createProject(
      server,
      "Owned UseCase",
      "owned-usecase",
      "stub-owned-usecase"
    );
    const outsider = await createProject(
      server,
      "Other UseCase",
      "other-usecase",
      "stub-other-usecase"
    );
    await createActor(server, owner, "Customer");

    const forbidden = await server.fetch(`/v1/projects/${owner.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: outsider.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "Places an order" })
    });

    expect(forbidden.status).toBe(403);
    const problem = (await forbidden.json()) as ProblemResponse;
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Authenticate with an account that has project access."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member set-role",
      reason: "Ask a workspace owner for editor access."
    });

    const created = await server.fetch(`/v1/projects/${owner.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "Places an order" })
    });
    const body = (await created.json()) as UseCaseResponse;
    expect(created.status).toBe(201);
    expect(body.usecase.key).toBe("CHK-001");
  });
});
