import type { PrismaClient } from "@prisma/client";
import type { UseCaseScenarioCounts } from "../ports/scenario-store.js";

export async function countScenariosByUseCase(
  prisma: PrismaClient,
  projectId: string
): Promise<Map<string, UseCaseScenarioCounts>> {
  const grouped = await prisma.scenario.groupBy({
    _count: { _all: true },
    by: ["usecase_id", "type"],
    where: { usecase: { project_id: projectId } }
  });
  const counts = new Map<string, UseCaseScenarioCounts>();
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
