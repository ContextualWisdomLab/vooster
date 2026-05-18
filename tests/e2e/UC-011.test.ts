import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { addInterest } from "../helpers/interest-fixtures.js";
import {
  addStep,
  createMainScenario,
  type ProblemResponse,
  type ScenarioResponse,
  type StepResponse
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  createActor,
  createProject,
  createStakeholder,
  createUseCase
} from "../helpers/uc-fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-011 - Write the main success scenario", () => {
  test("MAIN: create main success scenario and append contiguous steps", async () => {
    const setup = await createProject(server, "Main Scenario", "main-scenario", "stub-main-scenario");
    const customer = await createActor(server, setup, "Customer");
    const clerk = await createActor(server, setup, "Fulfillment Clerk");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    await createStakeholder(server, setup, "Product Manager");
    await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue is protected.",
      stakeholder: "Product Manager"
    });

    const createdScenario = await createMainScenario(server, usecase.id, setup.cookie);

    expect(createdScenario.status).toBe(201);
    const scenarioBody = (await createdScenario.json()) as ScenarioResponse;
    expect(scenarioBody.scenario).toMatchObject({
      order_index: 0,
      outcome: "SUCCESS",
      type: "MAIN_SUCCESS",
      usecase_id: usecase.id
    });
    expect(scenarioBody.revision).toMatchObject({
      change_summary: `Created main success scenario ${scenarioBody.scenario.id}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      severity: "NON_BREAKING",
      version_number: 3
    });
    expect(scenarioBody.steps).toEqual([]);

    const firstStep = await addStep(server, scenarioBody.scenario.id, setup.cookie, {
      action: "Places an order.",
      actor: "Customer"
    });
    expect(firstStep.status).toBe(201);
    const firstStepBody = (await firstStep.json()) as StepResponse;
    expect(firstStepBody.step).toMatchObject({
      action: "Places an order.",
      actor_id: customer.id,
      scenario_id: scenarioBody.scenario.id,
      step_number: 1
    });
    expect(firstStepBody.revision.version_number).toBe(4);

    const secondStep = await addStep(server, scenarioBody.scenario.id, setup.cookie, {
      action: "Reviews the order.",
      actor: "Fulfillment Clerk"
    });
    expect(secondStep.status).toBe(201);
    const secondStepBody = (await secondStep.json()) as StepResponse;
    expect(secondStepBody.step).toMatchObject({
      action: "Reviews the order.",
      actor_id: clerk.id,
      scenario_id: scenarioBody.scenario.id,
      step_number: 2
    });
    expect(secondStepBody.revision.version_number).toBe(5);
    expect(secondStepBody.scenario_steps.map((step) => step.step_number)).toEqual([1, 2]);
    expect(secondStepBody.scenario_steps.map((step) => step.action)).toEqual([
      "Places an order.",
      "Reviews the order."
    ]);
  });

  test("2a: duplicate main success scenario returns edit guidance", async () => {
    const setup = await createProject(server, "Duplicate Scenario", "duplicate-scenario", "stub-duplicate-scenario");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    await createStakeholder(server, setup, "Product Manager");
    await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue is protected.",
      stakeholder: "Product Manager"
    });
    const first = await createMainScenario(server, usecase.id, setup.cookie);
    const firstBody = (await first.json()) as ScenarioResponse;

    const duplicate = await createMainScenario(server, usecase.id, setup.cookie);

    expect(duplicate.status).toBe(409);
    const problem = (await duplicate.json()) as ProblemResponse;
    expect(problem.title).toMatch(/main_success scenario already exists/i);
    expect(problem.existing_scenario_id).toBe(firstBody.scenario.id);
    expect(problem.suggested_next_actions).toEqual([
      {
        command: "vspec step add",
        reason: "Extend the existing main success scenario."
      },
      {
        command: "vspec scenario edit",
        reason: "Modify the existing main success scenario."
      }
    ]);
  });
});
