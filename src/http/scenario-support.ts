import { randomUUID } from "node:crypto";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

type UseCaseRevisionResponse = {
  change_summary: string;
  entity_id: string;
  entity_type: "USECASE";
  id: string;
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING";
  snapshot: StoredUseCase;
  version_number: number;
};

export function mainSuccessScenario(
  state: SignupState,
  usecaseId: string
): StoredScenario | undefined {
  return (state.scenariosByUseCaseId.get(usecaseId) ?? []).find(
    (scenario) => scenario.type === "MAIN_SUCCESS"
  );
}

export function extensionPointParentStep(extensionPoint: string): number | null {
  const match = /^(?<step>\d+)[a-z]$/.exec(extensionPoint);
  return match?.groups?.step === undefined ? null : Number.parseInt(match.groups.step, 10);
}

export function mainScenarioHasStep(
  state: SignupState,
  mainScenario: StoredScenario,
  stepNumber: number
): boolean {
  return (state.stepsByScenarioId.get(mainScenario.id) ?? []).some(
    (step) => step.step_number === stepNumber
  );
}

export function scenarioWithUseCase(
  state: SignupState,
  scenarioId: string
): { projectId: string; scenario: StoredScenario; usecase: StoredUseCase } | undefined {
  for (const [usecaseId, scenarios] of state.scenariosByUseCaseId) {
    const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
    const found = scenario === undefined ? undefined : useCaseWithProjectId(state, usecaseId);
    if (scenario !== undefined && found !== undefined) {
      return { projectId: found.projectId, scenario, usecase: found.usecase };
    }
  }

  return undefined;
}

export function appendUseCaseRevision(
  state: SignupState,
  usecase: StoredUseCase,
  changeSummary: string,
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING" = "NON_BREAKING"
) {
  const revision = {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase },
    change_summary: changeSummary,
    severity
  };
  state.revisionsByEntityId.set(usecase.id, [
    ...(state.revisionsByEntityId.get(usecase.id) ?? []),
    revision
  ]);
  return revision;
}

export function duplicateMainSuccessProblem(existing: StoredScenario) {
  return problem(
    409,
    "MAIN_SUCCESS scenario already exists",
    { existing_scenario_id: existing.id },
    [
      {
        command: "vspec step add",
        reason: "Extend the existing main success scenario."
      },
      {
        command: "vspec scenario edit",
        reason: "Modify the existing main success scenario."
      }
    ]
  );
}

export function passiveActionProblem(action: string) {
  return problem(
    422,
    "Step action uses passive voice",
    { suggested_action: activeRewrite(action) },
    [
      {
        command: "vspec step add --force",
        reason: "Persist this wording after reviewing the passive voice warning."
      }
    ]
  );
}

export function unknownStepActorProblem(knownActorNames: string[]) {
  return problem(
    422,
    "Step actor is not registered",
    { known_actors: knownActorNames },
    [
      {
        command: "vspec actor create",
        reason: "Create the actor before adding this step."
      }
    ]
  );
}

export function stepCreateResponse(
  step: StoredStep,
  revision: UseCaseRevisionResponse,
  scenarioSteps: StoredStep[]
) {
  return {
    step,
    revision,
    scenario_steps: scenarioSteps,
    ...(scenarioSteps.length > 9
      ? {
          warnings: [
            {
              type: "SCENARIO_OVER_NINE_STEPS",
              message:
                "Scenarios over nine steps usually indicate the use case should be split."
            }
          ]
        }
      : {})
  };
}

export function usesPassiveVoice(action: string): boolean {
  return /^.+?\s+is\s+\w+ed\.?$/i.test(action.trim());
}

function activeRewrite(action: string): string {
  const match = /^(?<object>.+?)\s+is\s+(?<verb>\w+)\.?$/i.exec(action.trim());
  if (match?.groups === undefined) {
    return "Rewrite the step in active voice.";
  }
  const object = match.groups.object;
  const verb = match.groups.verb;
  if (object === undefined || verb === undefined) {
    return "Rewrite the step in active voice.";
  }

  return `${activeVerb(verb)} the ${object.toLowerCase()}.`;
}

function activeVerb(verb: string): string {
  return verb.toLowerCase() === "submitted" ? "Submits" : verb;
}
