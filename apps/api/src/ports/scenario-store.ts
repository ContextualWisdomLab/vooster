import type { StoredScenario } from "../domain/entities/index.js";

export type UseCaseScenarioCounts = {
  extension_count: number;
  scenario_count: number;
};

export type ScenarioStore = {
  findMainScenario: (usecaseId: string) => Promise<StoredScenario | undefined>;
  findScenarioById: (scenarioId: string) => Promise<StoredScenario | undefined>;
  countScenariosByUseCase: (
    projectId: string
  ) => Promise<Map<string, UseCaseScenarioCounts>>;
  listScenarios: (usecaseId: string) => Promise<StoredScenario[]>;
  saveScenario: (scenario: StoredScenario) => Promise<void>;
};
