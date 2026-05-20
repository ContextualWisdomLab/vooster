import type { StoredScenario } from "../domain/entities/index.js";
import type { ScenarioStore } from "../ports/scenario-store.js";

export function createMemoryScenarioStore(): ScenarioStore {
  const scenariosByUseCase = new Map<string, StoredScenario[]>();

  return {
    findMainScenario(usecaseId) {
      return Promise.resolve(
        (scenariosByUseCase.get(usecaseId) ?? []).find(
          (scenario) => scenario.type === "MAIN_SUCCESS"
        )
      );
    },

    findScenarioById(scenarioId) {
      return Promise.resolve(
        [...scenariosByUseCase.values()]
          .flat()
          .find((scenario) => scenario.id === scenarioId)
      );
    },

    listScenarios(usecaseId) {
      return Promise.resolve(scenariosByUseCase.get(usecaseId) ?? []);
    },

    saveScenario(scenario) {
      const existing = scenariosByUseCase.get(scenario.usecase_id) ?? [];
      scenariosByUseCase.set(scenario.usecase_id, [...existing, scenario]);
      return Promise.resolve();
    }
  };
}
