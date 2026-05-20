import type { PrismaClient } from "@prisma/client";

import type { StoredSpecBranch } from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import {
  specBranchData,
  specBranchUpdate,
  storedBranch
} from "./prisma-signup-mappers.js";

export function createPrismaBranchStore(prisma: PrismaClient): BranchStore {
  return new PrismaBranchStore(prisma);
}

class PrismaBranchStore implements BranchStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findBranchById(branchId: string): Promise<StoredSpecBranch | undefined> {
    const branch = await this.prisma.specBranch.findUnique({
      where: { id: branchId }
    });

    return branch === null ? undefined : storedBranch(branch);
  }

  async findBranchByProjectAndName(
    projectId: string,
    name: string
  ): Promise<StoredSpecBranch | undefined> {
    const branch = await this.prisma.specBranch.findUnique({
      where: {
        project_id_name: {
          name,
          project_id: projectId
        }
      }
    });

    return branch === null ? undefined : storedBranch(branch);
  }

  async listBranches(projectId: string): Promise<StoredSpecBranch[]> {
    const branches = await this.prisma.specBranch.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return branches.map(storedBranch);
  }

  async saveBranch(branch: StoredSpecBranch): Promise<void> {
    await this.prisma.specBranch.create({ data: specBranchData(branch) });
  }

  async updateBranch(branch: StoredSpecBranch): Promise<void> {
    await this.prisma.specBranch.update({
      data: specBranchUpdate(branch),
      where: { id: branch.id }
    });
  }
}
