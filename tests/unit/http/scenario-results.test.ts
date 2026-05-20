import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import {
  sendAddScenarioStepResult,
  sendCreateScenarioResult
} from "../../../src/http/scenario-results.js";
import type {
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

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
        result: { status: "MISSING_STAKEHOLDER_INTEREST" as const },
        title: "Use case needs at least one stakeholder interest"
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
  });

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
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function scenario(): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-1",
    order_index: 0,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1"
  };
}

function revision(): StoredRevision {
  return {
    change_summary: "Created scenario",
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    severity: "NON_BREAKING",
    snapshot: usecase(),
    version_number: 2
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Places an order"
  };
}

function step(): StoredStep {
  return {
    action: "Reviews the order.",
    actor_id: "actor-1",
    id: "step-1",
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-1",
    step_number: 1
  };
}
