import { describe, expect, test } from "vitest";
import {
  scenarioCreateRequestSchema,
  scenarioCreateResponseSchema,
  scenarioDryRunQuerySchema,
  scenarioParamsSchema,
  scenarioStepCreateRequestSchema,
  scenarioStepCreateResponseSchema,
  scenarioStepParamsSchema,
  stepMoveRequestSchema,
  stepMoveResponseSchema,
  stepParamsSchema,
  stepPatchRequestSchema,
  stepUpdateResponseSchema
} from "../src/index.js";

describe("scenario and step contracts", () => {
  test("parses scenario and step request boundaries", () => {
    expect(
      scenarioCreateRequestSchema.parse({
        condition: "Payment is declined",
        extension_point: "1a",
        outcome: "FAILURE",
        type: "EXTENSION"
      })
    ).toEqual({
      condition: "Payment is declined",
      extension_point: "1a",
      outcome: "FAILURE",
      type: "EXTENSION"
    });
    expect(
      scenarioStepCreateRequestSchema.parse({ action: "Pays.", actor: "Customer" })
    ).toEqual({
      action: "Pays.",
      actor: "Customer",
      force: false
    });
    expect(
      scenarioStepCreateRequestSchema.parse({
        action: "Pays.",
        actor: "Customer",
        position: 2
      }).position
    ).toBe(2);
    expect(stepMoveRequestSchema.parse({ to: 1 })).toEqual({ to: 1 });
    expect(
      stepPatchRequestSchema.parse({
        actor: "Support",
        base_revision: "revision-1",
        implements: ["tests/UC-013.feature:scenario_login", "src/auth/login.ts"]
      })
    ).toEqual({
      actor: "Support",
      base_revision: "revision-1",
      force: false,
      implements: ["tests/UC-013.feature:scenario_login", "src/auth/login.ts"]
    });
    expect(scenarioParamsSchema.parse({ usecaseId: "PAY-001" }).usecaseId).toBe(
      "PAY-001"
    );
    expect(
      scenarioStepParamsSchema.parse({ scenarioId: "scenario-1" }).scenarioId
    ).toBe("scenario-1");
    expect(stepParamsSchema.parse({ stepId: "step-1" }).stepId).toBe("step-1");
    expect(scenarioDryRunQuerySchema.parse({ dry_run: "true" })).toBe(true);
  });

  test("rejects malformed scenario and step request boundaries", () => {
    expect(() => scenarioCreateRequestSchema.parse({ type: "ALT" })).toThrow();
    expect(() =>
      scenarioStepCreateRequestSchema.parse({ action: "Pays.", actor: "" })
    ).toThrow();
    expect(() => stepMoveRequestSchema.parse({ to: 0 })).toThrow();
    expect(() => stepPatchRequestSchema.parse({ action: "Pays." })).toThrow();
    expect(() =>
      stepPatchRequestSchema.parse({
        base_revision: "revision-1",
        implements: ["bad ref"]
      })
    ).toThrow();
    expect(() => scenarioParamsSchema.parse({ usecaseId: "" })).toThrow();
    expect(() => scenarioStepParamsSchema.parse({ scenarioId: "" })).toThrow();
    expect(() => stepParamsSchema.parse({ stepId: "" })).toThrow();
  });

  test("parses scenario and step success responses without dropping stored fields", () => {
    const created = scenarioCreateResponseSchema.parse({
      revision: revision(),
      scenario: scenario(),
      steps: [step()]
    });

    expect(created.scenario.id).toBe("scenario-1");
    expect(created.scenario.usecase_id).toBe("usecase-1");
    expect(created.steps[0]?.invokes).toEqual(["PAY-002"]);
    expect(created.steps[0]?.implements).toEqual([
      "tests/UC-013.feature:scenario_login"
    ]);
    expect(
      scenarioStepCreateResponseSchema.parse({
        revision: revision(),
        scenario_steps: [step()],
        step: step(),
        warnings: [{ message: "Long scenario.", type: "SCENARIO_OVER_NINE_STEPS" }]
      }).step.id
    ).toBe("step-1");
    expect(
      stepMoveResponseSchema.parse({
        revision: revision(),
        scenario_steps: [step()],
        step: step()
      }).scenario_steps[0]?.id
    ).toBe("step-1");
    expect(
      stepUpdateResponseSchema.parse({
        affected_sessions: ["session-1"],
        revision: revision(),
        step: step()
      }).affected_sessions
    ).toEqual(["session-1"]);
  });
});

function scenario() {
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

function step() {
  return {
    action: "Pays the order.",
    actor_id: "actor-1",
    id: "step-1",
    implements: ["tests/UC-013.feature:scenario_login"],
    invokes: ["PAY-002"],
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-1",
    step_number: 1
  };
}

function revision() {
  return {
    change_summary: "Created main success scenario scenario-1",
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    severity: "NON_BREAKING",
    snapshot: {},
    version_number: 1
  };
}
