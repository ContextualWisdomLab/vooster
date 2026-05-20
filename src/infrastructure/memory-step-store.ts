import type { StoredStep } from "../domain/entities/index.js";
import type { StepStore } from "../ports/step-store.js";

export function createMemoryStepStore(): StepStore {
  const stepsByScenarioId = new Map<string, StoredStep[]>();

  return {
    findStepById(stepId) {
      return Promise.resolve(
        [...stepsByScenarioId.values()].flat().find((step) => step.id === stepId)
      );
    },

    listSteps(scenarioId) {
      return Promise.resolve(stepsByScenarioId.get(scenarioId) ?? []);
    },

    saveStep(step) {
      stepsByScenarioId.set(step.scenario_id, [
        ...(stepsByScenarioId.get(step.scenario_id) ?? []),
        step
      ]);
      return Promise.resolve();
    },

    updateStep(step) {
      stepsByScenarioId.set(
        step.scenario_id,
        (stepsByScenarioId.get(step.scenario_id) ?? []).map((candidate) =>
          candidate.id === step.id ? step : candidate
        )
      );
      return Promise.resolve();
    }
  };
}
