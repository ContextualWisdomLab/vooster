import type { StoredUseCase } from "../domain/entities/index.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function createMemoryUseCaseStore(): UseCaseStore {
  const usecasesByProject = new Map<string, StoredUseCase[]>();

  return {
    findUseCaseById(projectId, usecaseId) {
      return Promise.resolve(
        (usecasesByProject.get(projectId) ?? []).find(
          (usecase) => usecase.id === usecaseId
        )
      );
    },

    findUseCaseWithProject(usecaseIdOrKey) {
      for (const [projectId, usecases] of usecasesByProject) {
        const usecase = usecases.find(
          (candidate) =>
            candidate.id === usecaseIdOrKey || candidate.key === usecaseIdOrKey
        );
        if (usecase !== undefined) {
          return Promise.resolve({ projectId, usecase });
        }
      }

      return Promise.resolve(undefined);
    },

    findUseCasesByKey(key) {
      return Promise.resolve(
        [...usecasesByProject.values()]
          .flat()
          .filter((usecase) => usecase.key === key)
      );
    },

    listUseCases(projectId) {
      return Promise.resolve(usecasesByProject.get(projectId) ?? []);
    },

    saveUseCase(usecase) {
      const existing = usecasesByProject.get(usecase.project_id) ?? [];
      usecasesByProject.set(usecase.project_id, [...existing, usecase]);
      return Promise.resolve();
    },

    updateUseCase(usecase) {
      const existing = usecasesByProject.get(usecase.project_id) ?? [];
      usecasesByProject.set(
        usecase.project_id,
        existing.map((candidate) => candidate.id === usecase.id ? usecase : candidate)
      );
      return Promise.resolve();
    }
  };
}
