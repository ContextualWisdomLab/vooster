import type { PrismaClient } from "@prisma/client";

import type { StoredStakeholder } from "../domain/entities/index.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import {
  stakeholderData,
  storedStakeholder
} from "./prisma-signup-mappers.js";

export function createPrismaStakeholderStore(prisma: PrismaClient): StakeholderStore {
  return new PrismaStakeholderStore(prisma);
}

class PrismaStakeholderStore implements StakeholderStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findStakeholderById(
    projectId: string,
    stakeholderId: string
  ): Promise<StoredStakeholder | undefined> {
    const stakeholder = await this.prisma.stakeholder.findFirst({
      where: { id: stakeholderId, project_id: projectId }
    });

    return stakeholder === null ? undefined : storedStakeholder(stakeholder);
  }

  async findStakeholderByName(
    projectId: string,
    name: string
  ): Promise<StoredStakeholder | undefined> {
    const stakeholder = await this.prisma.stakeholder.findUnique({
      where: { project_id_name: { name, project_id: projectId } }
    });

    return stakeholder === null ? undefined : storedStakeholder(stakeholder);
  }

  async listStakeholders(projectId: string): Promise<StoredStakeholder[]> {
    const stakeholders = await this.prisma.stakeholder.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return stakeholders.map(storedStakeholder);
  }

  async saveStakeholder(stakeholder: StoredStakeholder): Promise<void> {
    await this.prisma.stakeholder.create({
      data: stakeholderData(stakeholder)
    });
  }
}
