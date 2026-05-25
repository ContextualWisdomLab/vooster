import type { PrismaClient } from "@prisma/client";

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
    const grouped = await this.prisma.scenario.groupBy({
      _count: { _all: true },
      by: ["usecase_id", "type"],
      where: { usecase: { project_id: projectId } }
    });
    const counts = new Map<
      string,
      { extension_count: number; scenario_count: number }
    >();
    for (const row of grouped) {
      const current = counts.get(row.usecase_id) ?? {
        extension_count: 0,
        scenario_count: 0
      };
      current.scenario_count += row._count._all;
      if (row.type === "EXTENSION") {
        current.extension_count += row._count._all;
      }
      counts.set(row.usecase_id, current);
    }
    return counts;
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
