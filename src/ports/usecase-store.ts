import type { StoredUseCase } from "../http/signup-types.js";

export type UseCaseLookup = {
  projectId: string;
  usecase: StoredUseCase;
};

export type UseCaseStore = {
  findUseCaseById: (projectId: string, usecaseId: string) => Promise<StoredUseCase | undefined>;
  findUseCaseWithProject: (usecaseIdOrKey: string) => Promise<UseCaseLookup | undefined>;
  findUseCasesByKey: (key: string) => Promise<StoredUseCase[]>;
  listUseCases: (projectId: string) => Promise<StoredUseCase[]>;
  saveUseCase: (usecase: StoredUseCase) => Promise<void>;
  updateUseCase: (usecase: StoredUseCase) => Promise<void>;
};
