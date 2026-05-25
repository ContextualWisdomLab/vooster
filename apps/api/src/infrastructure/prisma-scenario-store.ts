import type { PrismaClient } from "@prisma/client";

import { countScenariosByUseCase } from "./prisma-scenario-counts.js";
import type { StoredScenario } from "../domain/entities/index.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import { scenarioData, storedScenario } from "./prisma-signup-mappers.js";

export function createPrismaScenarioStore(prisma: PrismaClient): ScenarioStore {
  return new PrismaScenarioStore(prisma);
}

class PrismaScenarioStore implements ScenarioStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findMainScenario(usecaseId: string): Promise<StoredScenario | undefined> {
    const scenario = await this.prisma.scenario.findFirst({
      where: { type: "MAIN_SUCCESS", usecase_id: usecaseId }
    });

    return scenario === null ? undefined : storedScenario(scenario);
  }

  async findScenarioById(scenarioId: string): Promise<StoredScenario | undefined> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    return scenario === null ? undefined : storedScenario(scenario);
  }

  async countScenariosByUseCase(projectId: string) {
    return countScenariosByUseCase(this.prisma, projectId);
  }

  async listScenarios(usecaseId: string): Promise<StoredScenario[]> {
    const scenarios = await this.prisma.scenario.findMany({
      orderBy: { order_index: "asc" },
      where: { usecase_id: usecaseId }
    });

    return scenarios.map(storedScenario);
  }

  async saveScenario(scenario: StoredScenario): Promise<void> {
    await this.prisma.scenario.create({
      data: scenarioData(scenario)
    });
  }
}
