import type { PrismaClient } from "@prisma/client";

import type { StoredStakeholderInterest } from "../domain/entities/index.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import {
  stakeholderInterestData,
  storedStakeholderInterest
} from "./prisma-signup-mappers.js";

export function createPrismaStakeholderInterestStore(
  prisma: PrismaClient
): StakeholderInterestStore {
  return new PrismaStakeholderInterestStore(prisma);
}

class PrismaStakeholderInterestStore implements StakeholderInterestStore {
  constructor(private readonly prisma: PrismaClient) {}

  async deleteStakeholderInterest(interestId: string): Promise<void> {
    await this.prisma.stakeholderInterest.deleteMany({
      where: { id: interestId }
    });
  }

  async findStakeholderInterestById(
    usecaseId: string,
    interestId: string
  ): Promise<StoredStakeholderInterest | undefined> {
    const interest = await this.prisma.stakeholderInterest.findFirst({
      where: { id: interestId, usecase_id: usecaseId }
    });

    return interest === null ? undefined : storedStakeholderInterest(interest);
  }

  async findStakeholderInterestForStakeholder(
    usecaseId: string,
    stakeholderId: string
  ): Promise<StoredStakeholderInterest | undefined> {
    const interest = await this.prisma.stakeholderInterest.findUnique({
      where: {
        usecase_id_stakeholder_id: {
          stakeholder_id: stakeholderId,
          usecase_id: usecaseId
        }
      }
    });

    return interest === null ? undefined : storedStakeholderInterest(interest);
  }

  async listStakeholderInterests(
    usecaseId: string
  ): Promise<StoredStakeholderInterest[]> {
    const interests = await this.prisma.stakeholderInterest.findMany({
      orderBy: { created_at: "asc" },
      where: { usecase_id: usecaseId }
    });

    return interests.map(storedStakeholderInterest);
  }

  async saveStakeholderInterest(interest: StoredStakeholderInterest): Promise<void> {
    await this.prisma.stakeholderInterest.create({
      data: stakeholderInterestData(interest)
    });
  }
}
