import { randomUUID } from "node:crypto";
import type { StoredUseCase } from "./signup-types.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export async function nextUseCaseKey(
  useCaseStore: UseCaseStore,
  projectId: string,
  projectKey: string,
  skipCount = 0
): Promise<string> {
  const nextNumber = (await useCaseStore.listUseCases(projectId)).length + 1 + skipCount;
  return `${projectKey}-${String(nextNumber).padStart(3, "0")}`;
}

export function useCaseRevision(
  usecase: StoredUseCase,
  changeSummary?: string
) {
  return {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: usecase.id,
    version_number: 1,
    snapshot: { ...usecase },
    ...(changeSummary === undefined ? {} : { change_summary: changeSummary })
  };
}

export function useCaseNextActions(key: string) {
  return [
    { command: `vspec usecase show ${key}`, reason: "Open the new use case." },
    {
      command: "vspec usecase add-stakeholder",
      reason: "Attach stakeholders and interests."
    },
    { command: "vspec scenario add", reason: "Write the main success scenario." }
  ];
}
