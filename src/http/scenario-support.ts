import { problem } from "./signup-support.js";
import type { SignupState, StoredScenario } from "./signup-types.js";

export function mainSuccessScenario(
  state: SignupState,
  usecaseId: string
): StoredScenario | undefined {
  return (state.scenariosByUseCaseId.get(usecaseId) ?? []).find(
    (scenario) => scenario.type === "MAIN_SUCCESS"
  );
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
