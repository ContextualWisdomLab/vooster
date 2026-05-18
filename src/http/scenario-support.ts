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
