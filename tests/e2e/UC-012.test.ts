import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createExtensionScenario,
  createScenarioReadyUseCase,
  type ProblemResponse,
  type ScenarioResponse,
  type StepResponse
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-012 - Add an extension flow", () => {
  test("MAIN: add extension scenario and append extension substep", async () => {
    const { scenario: mainScenario, setup, usecase } = await createScenarioReadyUseCase(
      server,
      "Extension Flow",
      "extension-flow",
      "stub-extension-flow"
    );
    await addStep(server, mainScenario.scenario.id, setup.cookie, {
      action: "Places an order.",
      actor: "Customer"
    });

    const createdExtension = await createExtensionScenario(
      server,
      usecase.id,
      setup.cookie,
      {
        condition: "Payment is declined.",
        extension_point: "1a",
        outcome: "FAILURE"
      }
    );

    expect(createdExtension.status).toBe(201);
    const extensionBody = (await createdExtension.json()) as ScenarioResponse;
    expect(extensionBody.scenario).toMatchObject({
      condition: "Payment is declined.",
      extension_point: "1a",
      order_index: 1,
      outcome: "FAILURE",
      parent_step_number: 1,
      type: "EXTENSION",
      usecase_id: usecase.id
    });
    expect(extensionBody.revision).toMatchObject({
      change_summary: `Created extension scenario ${extensionBody.scenario.id}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      severity: "NON_BREAKING",
      version_number: 5
    });

    const substep = await addStep(server, extensionBody.scenario.id, setup.cookie, {
      action: "Shows payment error.",
      actor: "Customer"
    });
    expect(substep.status).toBe(201);
    const substepBody = (await substep.json()) as StepResponse;
    expect(substepBody.step).toMatchObject({
      action: "Shows payment error.",
      scenario_id: extensionBody.scenario.id,
      step_number: 1
    });
    expect(substepBody.revision.version_number).toBe(6);
  });

  test("2a: invalid extension point syntax returns valid forms", async () => {
    const { scenario: mainScenario, setup, usecase } = await createScenarioReadyUseCase(
      server,
      "Invalid Extension Point",
      "invalid-extension-point",
      "stub-invalid-extension-point"
    );
    await addStep(server, mainScenario.scenario.id, setup.cookie, {
      action: "Places an order.",
      actor: "Customer"
    });

    const invalid = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Payment is declined.",
      extension_point: "step3a",
      outcome: "FAILURE"
    });

    expect(invalid.status).toBe(400);
    const problem = (await invalid.json()) as ProblemResponse;
    expect(problem.title).toMatch(/invalid extension point/i);
    expect(problem.valid_extension_point_forms).toEqual(["^\\d+[a-z]$", "^\\*[a-z]$"]);
    expect(problem.example_extension_points).toEqual(["3a", "7c", "*a"]);

    const valid = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Payment is declined.",
      extension_point: "1a",
      outcome: "FAILURE"
    });
    const body = (await valid.json()) as ScenarioResponse;
    expect(body.revision.version_number).toBe(5);
  });
});
