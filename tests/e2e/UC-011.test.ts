import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { addInterest } from "../helpers/interest-fixtures.js";
import {
  addStep,
  createMainScenario,
  createScenarioReadyUseCase,
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
    const { scenario, setup, usecase } = await createScenarioReadyUseCase(
      server,
      "Duplicate Scenario",
      "duplicate-scenario",
      "stub-duplicate-scenario"
    );

    const duplicate = await createMainScenario(server, usecase.id, setup.cookie);

    expect(duplicate.status).toBe(409);
    const problem = (await duplicate.json()) as ProblemResponse;
    expect(problem.title).toMatch(/main_success scenario already exists/i);
    expect(problem.existing_scenario_id).toBe(scenario.scenario.id);
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

  test("3b: empty and passive step actions require correction or force", async () => {
    const { scenario, setup } = await createScenarioReadyUseCase(
      server,
      "Step Action",
      "step-action",
      "stub-step-action"
    );

    const empty = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "",
      actor: "Customer"
    });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as ProblemResponse).title).toMatch(/step action is required/i);

    const passive = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "Order is submitted.",
      actor: "Customer"
    });
    expect(passive.status).toBe(422);
    const passiveProblem = (await passive.json()) as ProblemResponse;
    expect(passiveProblem.title).toMatch(/passive voice/i);
    expect(passiveProblem.suggested_action).toBe("Submits the order.");
    expect(passiveProblem.suggested_next_actions).toContainEqual({
      command: "vspec step add --force",
      reason: "Persist this wording after reviewing the passive voice warning."
    });

    const forced = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "Order is submitted.",
      actor: "Customer",
      force: true
    });
    expect(forced.status).toBe(201);
    const forcedBody = (await forced.json()) as StepResponse;
    expect(forcedBody.step).toMatchObject({
      action: "Order is submitted.",
      step_number: 1
    });
    expect(forcedBody.revision.version_number).toBe(4);
    expect(forcedBody.scenario_steps).toHaveLength(1);
  });

  test("5a: unknown actor returns known actors and leaves numbering unchanged", async () => {
    const { scenario, setup } = await createScenarioReadyUseCase(
      server,
      "Unknown Step Actor",
      "unknown-step-actor",
      "stub-unknown-step-actor"
    );

    const unknown = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "Reviews the order.",
      actor: "Support Agent"
    });

    expect(unknown.status).toBe(422);
    const problem = (await unknown.json()) as ProblemResponse;
    expect(problem.title).toMatch(/actor.*not registered/i);
    expect(problem.known_actors).toEqual(["Customer"]);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec actor create",
      reason: "Create the actor before adding this step."
    });

    const valid = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "Places an order.",
      actor: "Customer"
    });
    const validBody = (await valid.json()) as StepResponse;
    expect(validBody.step.step_number).toBe(1);
    expect(validBody.scenario_steps).toHaveLength(1);
  });
});
