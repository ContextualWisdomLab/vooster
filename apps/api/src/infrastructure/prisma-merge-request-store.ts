import type { PrismaClient } from "@prisma/client";

import type { StoredMergeRequest } from "../domain/entities/index.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import {
  mergeRequestData,
  mergeRequestUpdate,
  storedMergeRequest
} from "./prisma-signup-mappers.js";

export function createPrismaMergeRequestStore(prisma: PrismaClient): MergeRequestStore {
  return new PrismaMergeRequestStore(prisma);
}

class PrismaMergeRequestStore implements MergeRequestStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findMergeRequestById(
    mergeRequestId: string
  ): Promise<StoredMergeRequest | undefined> {
    const mergeRequest = await this.prisma.mergeRequest.findUnique({
      where: { id: mergeRequestId }
    });

    return mergeRequest === null ? undefined : storedMergeRequest(mergeRequest);
  }

  async listOpenMergeRequests(): Promise<StoredMergeRequest[]> {
    const mergeRequests = await this.prisma.mergeRequest.findMany({
      orderBy: { created_at: "asc" },
      where: { status: "OPEN" }
    });

    return mergeRequests.map(storedMergeRequest);
  }

  async listOpenMergeRequestsByTargetBranchId(
    targetBranchId: string
  ): Promise<StoredMergeRequest[]> {
    const mergeRequests = await this.prisma.mergeRequest.findMany({
      orderBy: { created_at: "asc" },
      where: { status: "OPEN", target_branch_id: targetBranchId }
    });

    return mergeRequests.map(storedMergeRequest);
  }

  async saveMergeRequest(mergeRequest: StoredMergeRequest): Promise<void> {
    await this.prisma.mergeRequest.create({
      data: mergeRequestData(mergeRequest)
    });
  }

  async updateMergeRequest(mergeRequest: StoredMergeRequest): Promise<void> {
    await this.prisma.mergeRequest.update({
      data: mergeRequestUpdate(mergeRequest),
      where: { id: mergeRequest.id }
    });
  }
}
