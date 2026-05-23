import { afterEach, describe, expect, test } from "vitest";

import {
  bootServer,
  createActor,
  createActorResponse,
  createBranch,
  createBranchResponse,
  createGoal,
  createProject,
  createProjectResponse,
  createTestDatabaseRegistry,
  createUseCase,
  listGoals,
  login,
  promoteGoal,
  readUseCase,
  signupWorkspace
} from "./persistence-matrix-helpers.js";

const registry = createTestDatabaseRegistry();

describe("Goal 2 persistence matrix — authoring cluster", () => {
  afterEach(async () => {
    await registry.teardownAll();
  });

  test("Actor survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "actor-owner");
    const project = await createProject(first.url, signup, "Actor Matrix", "ACTOR");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "actor-owner");
    const duplicate = await createActorResponse(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      "Customer"
    );

    await second.stop();

    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      existing_actor_id?: unknown;
      title?: unknown;
    };
    expect(typeof duplicateBody.existing_actor_id).toBe("string");
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/actor name.*already exists/i)
    );
  }, 90_000);

  test("SpecBranch survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "branch-owner");
    const project = await createProject(first.url, signup, "Branch Matrix", "BRANCH");
    await createBranch(first.url, signup.sessionCookie, project.id, "feature/persist");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "branch-owner");
    const duplicate = await createBranchResponse(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      "feature/persist"
    );

    await second.stop();

    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      suggested_name?: unknown;
      title?: unknown;
    };
    expect(duplicateBody.suggested_name).toBe("feature/persist-2");
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/branch name is already in use/i)
    );
  }, 90_000);

  test("Goal survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "goal-owner");
    const project = await createProject(first.url, signup, "Goal Matrix", "GOAL");
    const actor = await createActor(
      first.url,
      signup.sessionCookie,
      project.id,
      "Customer"
    );
    const goal = await createGoal(
      first.url,
      signup.sessionCookie,
      project.id,
      actor.id,
      "Tracks an order"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "goal-owner");
    const listed = await listGoals(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      actor.id
    );

    await second.stop();

    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      actors?: Array<{ goals?: Array<{ id?: unknown }> }>;
    };
    expect(listedBody.actors?.[0]?.goals?.map((entry) => entry.id)).toContain(goal.id);
  }, 90_000);

  test("UseCase survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "usecase-owner");
    const project = await createProject(first.url, signup, "UseCase Matrix", "UCASE");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews persisted use cases",
      "Customer"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "usecase-owner");
    const shown = await readUseCase(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(shown.status).toBe(200);
    expect(shown.data.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(shown.data.title).toBe("Reviews persisted use cases");
    expect(shown.data.primary_actor).toEqual({ name: "Customer" });
  }, 90_000);

  test("ProjectKey survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "project-key-owner");
    const project = await createProject(first.url, signup, "Project Key Matrix", "PKM");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "project-key-owner");
    const duplicate = await createProjectResponse(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId,
      "Duplicate Project Key Matrix",
      "PKM"
    );

    await second.stop();

    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      existing_project?: { id?: unknown; key?: unknown };
      title?: unknown;
    };
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/project key is already in use/i)
    );
    expect(duplicateBody.existing_project).toMatchObject({
      id: project.id,
      key: "PKM"
    });
  }, 90_000);

  test("Project survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "project-owner");
    const project = await createProject(first.url, signup, "Project Matrix", "PROJ");
    const actor = await createActor(
      first.url,
      signup.sessionCookie,
      project.id,
      "Customer"
    );
    const goal = await createGoal(
      first.url,
      signup.sessionCookie,
      project.id,
      actor.id,
      "Completes a project workflow"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "project-owner");
    const promoted = await promoteGoal(second.url, loggedIn.sessionCookie, goal.id);

    await second.stop();

    expect(promoted.status).toBe(201);
    const promotedBody = (await promoted.json()) as {
      usecase?: { project_id?: unknown };
    };
    expect(promotedBody.usecase?.project_id).toBe(project.id);
  }, 90_000);
});
