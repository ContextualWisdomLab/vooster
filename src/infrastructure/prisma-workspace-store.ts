import type { PrismaClient } from "@prisma/client";

import type { StoredWorkspace } from "../domain/entities/index.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";
import {
  storedWorkspace,
  workspaceData
} from "./prisma-signup-mappers.js";

export function createPrismaWorkspaceStore(prisma: PrismaClient): WorkspaceStore {
  return new PrismaWorkspaceStore(prisma);
}

class PrismaWorkspaceStore implements WorkspaceStore {
  constructor(private readonly prisma: PrismaClient) {}

  async archiveWorkspace(workspaceId: string, archivedAt: string): Promise<void> {
    await this.prisma.workspace.update({
      data: { archived_at: new Date(archivedAt) },
      where: { id: workspaceId }
    });
  }

  async findWorkspaceById(workspaceId: string): Promise<StoredWorkspace | undefined> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    return workspace === null ? undefined : storedWorkspace(workspace);
  }

  async isWorkspaceArchived(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      select: { archived_at: true },
      where: { id: workspaceId }
    });

    return workspace?.archived_at !== null && workspace?.archived_at !== undefined;
  }

  async nextAvailableWorkspaceSlug(slug: string): Promise<string> {
    let suffix = 2;
    let candidate = `${slug}-${String(suffix)}`;

    while (await this.workspaceSlugExists(candidate)) {
      suffix += 1;
      candidate = `${slug}-${String(suffix)}`;
    }

    return candidate;
  }

  async saveWorkspace(workspace: StoredWorkspace): Promise<void> {
    await this.prisma.workspace.create({ data: workspaceData(workspace) });
  }

  async workspaceSlugExists(slug: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      select: { id: true },
      where: { slug }
    });

    return workspace !== null;
  }
}
