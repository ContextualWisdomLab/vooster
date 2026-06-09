import { randomUUID } from "node:crypto";
import { usesPassiveVoice } from "../application/passive-voice.js";
import { problem } from "./signup-support.js";
import type {
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../domain/entities/index.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

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
  scenarioStore: ScenarioStore,
  usecaseId: string
): Promise<StoredScenario | undefined> {
  return scenarioStore.findMainScenario(usecaseId);
}

export function extensionPointParentStep(extensionPoint: string): number | null {
  const match = /^(?<step>\d+)[a-z]$/.exec(extensionPoint);
  return match?.groups?.step === undefined
    ? null
    : Number.parseInt(match.groups.step, 10);
}

export async function mainScenarioHasStep(
  stepStore: StepStore,
  mainScenario: StoredScenario,
  stepNumber: number
): Promise<boolean> {
  return (await stepStore.listSteps(mainScenario.id)).some(
    (step) => step.step_number === stepNumber
  );
}

export function scenarioWithUseCase(
  scenarioStore: ScenarioStore,
  useCaseStore: UseCaseStore,
  scenarioId: string
): Promise<
  { projectId: string; scenario: StoredScenario; usecase: StoredUseCase } | undefined
> {
  return scenarioStore.findScenarioById(scenarioId).then(async (scenario) => {
    if (scenario === undefined) {
      return undefined;
    }
    const found = await useCaseStore.findUseCaseWithProject(scenario.usecase_id);
    return found === undefined
      ? undefined
      : { projectId: found.projectId, scenario, usecase: found.usecase };
  });
}

export async function appendUseCaseRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase,
  changeSummary: string,
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING" = "NON_BREAKING"
) {
  const revision = {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: usecase.id,
    version_number: await revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase },
    change_summary: changeSummary,
    severity
  };
  await revisionStore.saveRevision(revision);
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

export { usesPassiveVoice };

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
