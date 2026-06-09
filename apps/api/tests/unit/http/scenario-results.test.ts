import { describe, expect, test } from "vitest";
import {
  sendAddScenarioStepResult,
  sendCreateScenarioResult
} from "../../../src/http/scenario-results.js";
import type { StoredScenario } from "../../../src/domain/entities/index.js";
import { reply, revision, scenario, step } from "./scenario-results-fixtures.js";

describe("scenario result responses", () => {
  test("serializes create scenario validation failures", () => {
    const cases = [
      {
        expectedStatus: 400,
        result: { status: "INVALID_EXTENSION_POINT" as const },
        title: "Invalid extension point"
      },
      {
        expectedStatus: 400,
        result: { status: "INVALID_EXTENSION_REQUEST" as const },
        title: "Invalid extension scenario request"
      },
      {
        expectedStatus: 422,
        result: {
          status: "MISSING_STAKEHOLDER_INTEREST" as const,
          usecaseKey: "PAY-001"
        },
        title: "Use case needs at least one stakeholder interest"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCreateScenarioResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }

    const missingInterest = reply();
    sendCreateScenarioResult(missingInterest.fastifyReply, {
      status: "MISSING_STAKEHOLDER_INTEREST",
      usecaseKey: "PAY-001"
    });
    expect(missingInterest.body).toMatchObject({
      code: "SCHEMA_INVALID",
      suggested_next_actions: [
        {
          command:
            'vspec usecase add-stakeholder PAY-001 --stakeholder "<name>" --interest "<interest>"',
          reason: "Attach at least one stakeholder interest before adding scenarios."
        }
      ],
      title: "Use case needs at least one stakeholder interest"
    });
  });

  test("serializes create scenario conflicts and warnings", () => {
    const duplicate = reply();
    sendCreateScenarioResult(duplicate.fastifyReply, {
      existingCondition: "Payment is declined.",
      status: "DUPLICATE_EXTENSION_POINT",
      suggestedExtensionPoint: "1b"
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body).toMatchObject({
      existing_condition: "Payment is declined.",
      suggested_extension_point: "1b"
    });

    const duplicateMain = reply();
    sendCreateScenarioResult(duplicateMain.fastifyReply, {
      existingScenario: scenario(),
      status: "DUPLICATE_MAIN_SUCCESS"
    });
    expect(duplicateMain.body).toMatchObject({
      title: "MAIN_SUCCESS scenario already exists"
    });

    const outOfRange = reply();
    sendCreateScenarioResult(outOfRange.fastifyReply, {
      parentStepNumber: 10,
      status: "EXTENSION_PARENT_OUT_OF_RANGE",
      usecaseKey: "PAY-001"
    });
    expect(outOfRange.body).toMatchObject({
      parent_step_number: 10,
      title: "Extension parent step is out of range"
    });

    const created = reply();
    sendCreateScenarioResult(created.fastifyReply, {
      defaultOutcome: true,
      revision: revision(),
      scenario: scenario(),
      status: "CREATED",
      steps: []
    });

    expect(created.statusCode).toBe(201);
    expect(created.body).toMatchObject({
      warnings: [{ type: "DEFAULT_EXTENSION_OUTCOME" }]
    });

    const createdWithoutWarning = reply();
    sendCreateScenarioResult(createdWithoutWarning.fastifyReply, {
      revision: revision(),
      scenario: scenario(),
      status: "CREATED",
      steps: []
    });
    expect(createdWithoutWarning.body).not.toHaveProperty("warnings");
  });

  test.each(["MAIN_SUCCESS", "EXTENSION"] as const)(
    "serializes a concrete step-add next action for created %s scenarios",
    (type) => {
      const created = reply();
      const scenarioId = `scenario-${type.toLowerCase().replaceAll("_", "-")}`;

      sendCreateScenarioResult(created.fastifyReply, {
        revision: revision(),
        scenario: scenarioOfType(type, scenarioId),
        status: "CREATED",
        steps: []
      });

      const body = created.body as ScenarioCreateBody;
      expect(body.suggested_next_actions).toEqual([
        {
          command: `vspec step add ${scenarioId}`,
          reason: "Add the first step to the new scenario."
        }
      ]);
    }
  );

  test("serializes add step failures and warnings", () => {
    const passive = reply();
    sendAddScenarioStepResult(passive.fastifyReply, {
      status: "PASSIVE_ACTION",
      suggestedAction: "Submits the order."
    });

    expect(passive.statusCode).toBe(422);
    expect(passive.body).toMatchObject({
      suggested_action: "Submits the order.",
      title: "Step action uses passive voice"
    });

    const passiveWithoutSuggestion = reply();
    sendAddScenarioStepResult(passiveWithoutSuggestion.fastifyReply, {
      status: "PASSIVE_ACTION"
    });
    expect(passiveWithoutSuggestion.body).toMatchObject({ suggested_action: "" });

    const forbidden = reply();
    sendAddScenarioStepResult(forbidden.fastifyReply, { status: "FORBIDDEN" });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).toMatchObject({
      title: "Contact the workspace owner for access"
    });

    const missing = reply();
    sendAddScenarioStepResult(missing.fastifyReply, { status: "SCENARIO_NOT_FOUND" });

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Scenario not found" });

    const added = reply();
    sendAddScenarioStepResult(added.fastifyReply, {
      overNineSteps: true,
      revision: revision(),
      scenarioSteps: [step()],
      status: "STEP_ADDED",
      step: step()
    });

    expect(added.statusCode).toBe(201);
    expect(added.body).toMatchObject({
      warnings: [{ type: "SCENARIO_OVER_NINE_STEPS" }]
    });

    const addedWithoutWarning = reply();
    sendAddScenarioStepResult(addedWithoutWarning.fastifyReply, {
      overNineSteps: false,
      revision: revision(),
      scenarioSteps: [step()],
      status: "STEP_ADDED",
      step: step()
    });
    expect(addedWithoutWarning.body).not.toHaveProperty("warnings");

    const unknownActor = reply();
    sendAddScenarioStepResult(unknownActor.fastifyReply, {
      knownActors: ["Customer"],
      status: "UNKNOWN_STEP_ACTOR"
    });
    expect(unknownActor.body).toMatchObject({
      known_actors: ["Customer"],
      title: "Step actor is not registered"
    });
  });
});

type ScenarioCreateBody = {
  suggested_next_actions?: Array<{
    command: string;
    reason: string;
  }>;
};

function scenarioOfType(
  type: "EXTENSION" | "MAIN_SUCCESS",
  id: string
): StoredScenario {
  return {
    condition: type === "EXTENSION" ? "Card is declined" : null,
    extension_point: type === "EXTENSION" ? "1a" : null,
    id,
    order_index: 1,
    outcome: type === "EXTENSION" ? "FAILURE" : "SUCCESS",
    parent_step_number: type === "EXTENSION" ? 1 : null,
    type,
    usecase_id: "usecase-1"
  };
}
