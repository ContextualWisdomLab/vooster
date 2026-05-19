import type { StoredScenario } from "../http/signup-types.js";

export type ScenarioStore = {
  findMainScenario: (usecaseId: string) => Promise<StoredScenario | undefined>;
  findScenarioById: (scenarioId: string) => Promise<StoredScenario | undefined>;
  listScenarios: (usecaseId: string) => Promise<StoredScenario[]>;
  saveScenario: (scenario: StoredScenario) => Promise<void>;
};
