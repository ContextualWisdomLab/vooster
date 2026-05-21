import type { PrismaClient } from "@prisma/client";

import type { StoredUseCase } from "../domain/entities/index.js";
import type {
  UseCaseLookup,
  UseCaseStore
} from "../ports/usecase-store.js";
import {
  storedUseCase,
  useCaseData,
  useCaseUpdate
} from "./prisma-signup-mappers.js";

export function createPrismaUseCaseStore(prisma: PrismaClient): UseCaseStore {
  return new PrismaUseCaseStore(prisma);
}

class PrismaUseCaseStore implements UseCaseStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findUseCaseById(
    projectId: string,
    usecaseId: string
  ): Promise<StoredUseCase | undefined> {
    const usecase = await this.prisma.useCase.findFirst({
      where: { id: usecaseId, project_id: projectId }
    });

    return usecase === null ? undefined : storedUseCase(usecase);
  }

  async findUseCaseWithProject(
    usecaseIdOrKey: string
  ): Promise<UseCaseLookup | undefined> {
    const usecase = await this.prisma.useCase.findFirst({
      where: {
        OR: [
          { id: usecaseIdOrKey },
          { key: usecaseIdOrKey }
        ]
      }
    });

    return usecase === null
      ? undefined
      : { projectId: usecase.project_id, usecase: storedUseCase(usecase) };
  }

  async findUseCasesByKey(key: string): Promise<StoredUseCase[]> {
    const usecases = await this.prisma.useCase.findMany({
      orderBy: { created_at: "asc" },
      where: { key }
    });

    return usecases.map(storedUseCase);
  }

  async listUseCases(projectId: string): Promise<StoredUseCase[]> {
    const usecases = await this.prisma.useCase.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return usecases.map(storedUseCase);
  }

  async saveUseCase(usecase: StoredUseCase): Promise<void> {
    await this.prisma.useCase.create({
      data: useCaseData(usecase)
    });
  }

  async updateUseCase(usecase: StoredUseCase): Promise<void> {
    await this.prisma.useCase.update({
      data: useCaseUpdate(usecase),
      where: { id: usecase.id }
    });
  }
}
