import type { FastifyReply } from "fastify";
import {
  type ApiErrorCode,
  scenarioCreateResponseSchema,
  scenarioStepCreateResponseSchema,
  type SuggestedNextAction
} from "@vooster/contracts";
import type {
  AddScenarioStepResult,
  CreateScenarioResult
} from "../application/scenario-authoring.js";
import {
  duplicateMainSuccessProblem,
  unknownStepActorProblem
} from "./scenario-support.js";
import { problem, usecaseShowRecoveryActions } from "./signup-support.js";

const SCHEMA_INVALID = "SCHEMA_INVALID" satisfies ApiErrorCode;

export function sendCreateScenarioResult(
  reply: FastifyReply,
  result: CreateScenarioResult
) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send(
        scenarioCreateResponseSchema.parse({
          revision: result.revision,
          scenario: result.scenario,
          suggested_next_actions: scenarioCreateNextActions(result.scenario.id),
          steps: result.steps,
          ...(result.defaultOutcome === true ? defaultOutcomeWarning() : {})
        })
      );
    case "DUPLICATE_EXTENSION_POINT":
      return reply.code(409).send(
        problem(409, "Extension point is already taken", {
          existing_condition: result.existingCondition,
          suggested_extension_point: result.suggestedExtensionPoint
        })
      );
    case "DUPLICATE_MAIN_SUCCESS":
      return reply.code(409).send(duplicateMainSuccessProblem(result.existingScenario));
    case "EXTENSION_PARENT_OUT_OF_RANGE":
      return reply
        .code(422)
        .send(parentStepOutOfRangeProblem(result.usecaseKey, result.parentStepNumber));
    case "FORBIDDEN":
      return reply.code(403).send(accessProblem());
    case "INVALID_EXTENSION_POINT":
      return reply.code(400).send(invalidExtensionPointProblem());
    case "INVALID_EXTENSION_REQUEST":
      return reply.code(400).send(problem(400, "Invalid extension scenario request"));
    case "MISSING_STAKEHOLDER_INTEREST":
      return reply.code(422).send(missingStakeholderInterestProblem(result.usecaseKey));
    case "USECASE_NOT_FOUND":
      return reply
        .code(404)
        .send(problem(404, "Use case not found", {}, usecaseShowRecoveryActions()));
  }
}

function missingStakeholderInterestProblem(usecaseKey: string) {
  return problem(
    422,
    "Use case needs at least one stakeholder interest",
    { code: SCHEMA_INVALID },
    [
      {
        command: `vspec usecase add-stakeholder ${usecaseKey} --stakeholder "<name>" --interest "<interest>"`,
        reason: "Attach at least one stakeholder interest before adding scenarios."
      }
    ]
  );
}

function scenarioCreateNextActions(scenarioId: string): SuggestedNextAction[] {
  return [
    {
      command: `vspec step add ${scenarioId}`,
      reason: "Add the first step to the new scenario."
    }
  ];
}

export function sendAddScenarioStepResult(
  reply: FastifyReply,
  result: AddScenarioStepResult
) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(accessProblem());
    case "PASSIVE_ACTION":
      return reply.code(422).send(passiveActionProblem(result.suggestedAction ?? ""));
    case "SCENARIO_NOT_FOUND":
      return reply
        .code(404)
        .send(problem(404, "Scenario not found", {}, usecaseShowRecoveryActions()));
    case "STEP_ADDED":
      return reply.code(201).send(
        scenarioStepCreateResponseSchema.parse({
          revision: result.revision,
          scenario_steps: result.scenarioSteps,
          step: result.step,
          ...(result.overNineSteps ? overNineStepsWarning() : {})
        })
      );
    case "UNKNOWN_STEP_ACTOR":
      return reply.code(422).send(unknownStepActorProblem(result.knownActors));
  }
}

function accessProblem() {
  return problem(403, "Contact the workspace owner for access");
}

function defaultOutcomeWarning() {
  return {
    warnings: [
      {
        message:
          "Outcome defaulted to FAILURE; confirm it or edit the scenario outcome.",
        type: "DEFAULT_EXTENSION_OUTCOME"
      }
    ]
  };
}

function invalidExtensionPointProblem() {
  return problem(400, "Invalid extension point", {
    example_extension_points: ["3a", "7c", "*a"],
    valid_extension_point_forms: ["^\\d+[a-z]$", "^\\*[a-z]$"]
  });
}

function overNineStepsWarning() {
  return {
    warnings: [
      {
        message:
          "Scenarios over nine steps usually indicate the use case should be split.",
        type: "SCENARIO_OVER_NINE_STEPS"
      }
    ]
  };
}

function parentStepOutOfRangeProblem(
  usecaseKey: string,
  parentStepNumber: number | null
) {
  return problem(
    422,
    "Extension parent step is out of range",
    { parent_step_number: parentStepNumber },
    [
      {
        command: `vspec usecase show ${usecaseKey}`,
        reason: "Inspect the current main scenario step numbering."
      }
    ]
  );
}

function passiveActionProblem(suggestedAction: string) {
  return problem(
    422,
    "Step action uses passive voice",
    { suggested_action: suggestedAction },
    [
      {
        command: "vspec step add --force",
        reason: "Persist this wording after reviewing the passive voice warning."
      }
    ]
  );
}
