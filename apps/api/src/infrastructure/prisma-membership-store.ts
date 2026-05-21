import type { PrismaClient } from "@prisma/client";

import type { StoredMembership } from "../domain/entities/index.js";
import type { MembershipStore } from "../ports/membership-store.js";
import { storedMembership } from "./prisma-signup-mappers.js";

export function createPrismaMembershipStore(prisma: PrismaClient): MembershipStore {
  return new PrismaMembershipStore(prisma);
}

class PrismaMembershipStore implements MembershipStore {
  constructor(private readonly prisma: PrismaClient) {}

  async membershipForProject(
    projectId: string,
    userId: string
  ): Promise<StoredMembership | undefined> {
    const project = await this.prisma.project.findUnique({
      select: { workspace_id: true },
      where: { id: projectId }
    });
    if (project === null) {
      return undefined;
    }

    return this.membershipForWorkspace(project.workspace_id, userId);
  }

  async membershipForWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<StoredMembership | undefined> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId
        }
      }
    });

    return membership === null ? undefined : storedMembership(membership);
  }

  async membershipsForUser(userId: string): Promise<StoredMembership[]> {
    const memberships = await this.prisma.membership.findMany({
      orderBy: { id: "asc" },
      where: { user_id: userId }
    });

    return memberships.map(storedMembership);
  }

  async saveMembership(membership: StoredMembership): Promise<void> {
    await this.prisma.membership.create({ data: membership });
  }
}
