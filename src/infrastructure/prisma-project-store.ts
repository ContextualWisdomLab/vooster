import type { PrismaClient } from "@prisma/client";

import type { StoredProject } from "../domain/entities/index.js";
import type { ProjectStore } from "../ports/project-store.js";
import {
  projectData,
  storedProject
} from "./prisma-signup-mappers.js";

export function createPrismaProjectStore(prisma: PrismaClient): ProjectStore {
  return new PrismaProjectStore(prisma);
}

class PrismaProjectStore implements ProjectStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findProjectById(projectId: string): Promise<StoredProject | undefined> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    return project === null ? undefined : storedProject(project);
  }

  async findProjectByWorkspaceAndKey(
    workspaceId: string,
    key: string
  ): Promise<StoredProject | undefined> {
    const project = await this.prisma.project.findUnique({
      where: {
        workspace_id_key: {
          key,
          workspace_id: workspaceId
        }
      }
    });

    return project === null ? undefined : storedProject(project);
  }

  async listProjectsForWorkspace(workspaceId: string): Promise<StoredProject[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: { created_at: "asc" },
      where: { workspace_id: workspaceId }
    });

    return projects.map(storedProject);
  }

  async saveProject(project: StoredProject): Promise<void> {
    await this.prisma.project.create({
      data: projectData(project)
    });
  }
}
