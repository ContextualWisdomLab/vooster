import { randomUUID } from "node:crypto";
import type { SignupState, StoredUseCase } from "./signup-types.js";

export function nextUseCaseKey(
  state: SignupState,
  projectId: string,
  projectKey: string,
  skipCount = 0
): string {
  const nextNumber = (state.usecasesByProjectId.get(projectId) ?? []).length + 1 + skipCount;
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

export function useCaseWithId(
  state: SignupState,
  projectId: string,
  usecaseId: string
): StoredUseCase | undefined {
  return (state.usecasesByProjectId.get(projectId) ?? []).find(
    (usecase) => usecase.id === usecaseId
  );
}

export function useCaseWithProjectId(
  state: SignupState,
  usecaseIdOrKey: string
): { projectId: string; usecase: StoredUseCase } | undefined {
  for (const [projectId, usecases] of state.usecasesByProjectId) {
    const usecase = usecases.find((candidate) =>
      candidate.id === usecaseIdOrKey || candidate.key === usecaseIdOrKey
    );
    if (usecase !== undefined) {
      return { projectId, usecase };
    }
  }

  return undefined;
}
