import { afterEach, describe, expect, test } from "vitest";

import {
  addStakeholderInterest,
  bootServer,
  createActor,
  createLock,
  createMainScenario,
  createMainScenarioResponse,
  createProject,
  createStakeholder,
  createStep,
  createTestDatabaseRegistry,
  createUseCase,
  listSessions,
  login,
  showUseCase,
  signupWorkspace,
  startWorkSession,
  whoIsWorking
} from "./persistence-matrix-helpers.js";

const registry = createTestDatabaseRegistry();

describe("Goal 2 persistence matrix — session cluster", () => {
  afterEach(async () => {
    await registry.teardownAll();
  });

  test("WorkSession survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "work-session-owner");
    const project = await createProject(first.url, signup, "Work Session Matrix", "WS");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a session workflow",
      "Customer"
    );
    const session = await startWorkSession(
      first.url,
      signup.sessionCookie,
      project.id,
      usecase.key
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "work-session-owner");
    const listed = await listSessions(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId
    );

    await second.stop();

    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      sessions?: Array<{ id?: unknown; status?: unknown }>;
    };
    expect(listedBody.sessions ?? []).toContainEqual(
      expect.objectContaining({ id: session.id, status: "ACTIVE" })
    );
  }, 90_000);

  test("Lock survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "lock-owner");
    const project = await createProject(first.url, signup, "Lock Matrix", "LOCK");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a locked workflow",
      "Customer"
    );
    const lock = await createLock(first.url, signup.sessionCookie, usecase.id);

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "lock-owner");
    const who = await whoIsWorking(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(who.status).toBe(200);
    const whoBody = (await who.json()) as {
      locks?: Array<{ id?: unknown; lock_type?: unknown }>;
    };
    expect(whoBody.locks ?? []).toContainEqual(
      expect.objectContaining({ id: lock.id, lock_type: "HARD" })
    );
  }, 90_000);

  test("Scenario survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "scenario-owner");
    const project = await createProject(first.url, signup, "Scenario Matrix", "SCEN");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a scenario workflow",
      "Customer"
    );
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );
    const scenario = await createMainScenario(
      first.url,
      signup.sessionCookie,
      usecase.id
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "scenario-owner");
    const duplicate = await createMainScenarioResponse(
      second.url,
      loggedIn.sessionCookie,
      usecase.id
    );

    await second.stop();

    expect(duplicate.status).toBe(409);
    const duplicateBody = (await duplicate.json()) as {
      existing_scenario_id?: unknown;
      title?: unknown;
    };
    expect(duplicateBody.existing_scenario_id).toBe(scenario.id);
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/main_success scenario already exists/i)
    );
  }, 90_000);

  test("Step survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "step-owner");
    const project = await createProject(first.url, signup, "Step Matrix", "STEP");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a stepped workflow",
      "Customer"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );
    const scenario = await createMainScenario(
      first.url,
      signup.sessionCookie,
      usecase.id
    );
    const step = await createStep(
      first.url,
      signup.sessionCookie,
      scenario.id,
      "Customer",
      "Submit the support request."
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "step-owner");
    const shown = await showUseCase(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(shown.status).toBe(200);
    const shownBody = (await shown.json()) as {
      data?: {
        scenarios?: Array<{
          id?: unknown;
          steps?: Array<{ action?: unknown; actor?: unknown; step_number?: unknown }>;
        }>;
      };
    };
    const persistedScenario = (shownBody.data?.scenarios ?? []).find(
      (entry) => entry.id === scenario.id
    );
    expect(persistedScenario?.steps ?? []).toContainEqual(
      expect.objectContaining({
        action: step.action,
        actor: "Customer",
        invokes: [],
        step_number: 1
      })
    );
  }, 90_000);
});
