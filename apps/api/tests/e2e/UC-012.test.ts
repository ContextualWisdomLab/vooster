import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createExtensionScenario,
  createUseCaseWithMainStep,
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
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Extension Flow",
      "extension-flow",
      "stub-extension-flow"
    );

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
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Invalid Extension Point",
      "invalid-extension-point",
      "stub-invalid-extension-point"
    );

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

  test("3b: missing parent step reports out-of-range step", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Missing Parent Step",
      "missing-parent-step",
      "stub-missing-parent-step"
    );

    const missing = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Inventory is unavailable.",
      extension_point: "3a",
      outcome: "FAILURE"
    });

    expect(missing.status).toBe(422);
    const problem = (await missing.json()) as ProblemResponse;
    expect(problem.title).toMatch(/parent step.*out of range/i);
    expect(problem.parent_step_number).toBe(3);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key}`,
      reason: "Inspect the current main scenario step numbering."
    });

    const valid = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Payment is declined.",
      extension_point: "1a",
      outcome: "FAILURE"
    });
    const body = (await valid.json()) as ScenarioResponse;
    expect(body.revision.version_number).toBe(5);
  });

  test("4a: duplicate extension point returns existing condition and next letter", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Duplicate Extension",
      "duplicate-extension",
      "stub-duplicate-extension"
    );
    await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Payment is declined.",
      extension_point: "1a",
      outcome: "FAILURE"
    });

    const duplicate = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Inventory is unavailable.",
      extension_point: "1a",
      outcome: "FAILURE"
    });

    expect(duplicate.status).toBe(409);
    const problem = (await duplicate.json()) as ProblemResponse;
    expect(problem.title).toMatch(/extension point.*already taken/i);
    expect(problem.existing_condition).toBe("Payment is declined.");
    expect(problem.suggested_extension_point).toBe("1b");

    const next = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Inventory is unavailable.",
      extension_point: "1b",
      outcome: "FAILURE"
    });
    const body = (await next.json()) as ScenarioResponse;
    expect(body.revision.version_number).toBe(6);
  });

  test("5a: omitted outcome defaults to failure with confirmation warning", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Default Extension Outcome",
      "default-extension-outcome",
      "stub-default-extension-outcome"
    );

    const response = await createExtensionScenario(server, usecase.id, setup.cookie, {
      condition: "Payment is declined.",
      extension_point: "1a"
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ScenarioResponse;
    expect(body.scenario.outcome).toBe("FAILURE");
    expect(body.warnings).toContainEqual({
      type: "DEFAULT_EXTENSION_OUTCOME",
      message: "Outcome defaulted to FAILURE; confirm it or edit the scenario outcome."
    });
  });
});
