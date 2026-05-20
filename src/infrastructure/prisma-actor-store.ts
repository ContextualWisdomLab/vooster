import type { PrismaClient } from "@prisma/client";

import type { StoredActor } from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import {
  dateOrNull,
  storedActor
} from "./prisma-signup-mappers.js";

export function createPrismaActorStore(prisma: PrismaClient): ActorStore {
  return new PrismaActorStore(prisma);
}

class PrismaActorStore implements ActorStore {
  constructor(private readonly prisma: PrismaClient) {}

  async archiveActor(
    projectId: string,
    actorId: string,
    archivedAt: string
  ): Promise<boolean> {
    const result = await this.prisma.actor.updateMany({
      data: { archived_at: new Date(archivedAt) },
      where: { id: actorId, project_id: projectId }
    });

    return result.count > 0;
  }

  async findActorById(
    projectId: string,
    actorId: string
  ): Promise<StoredActor | undefined> {
    const actor = await this.prisma.actor.findFirst({
      where: { id: actorId, project_id: projectId }
    });

    return actor === null ? undefined : storedActor(actor);
  }

  async findActorByName(
    projectId: string,
    name: string
  ): Promise<StoredActor | undefined> {
    const actor = await this.prisma.actor.findUnique({
      where: { project_id_name: { name, project_id: projectId } }
    });

    return actor === null ? undefined : storedActor(actor);
  }

  async listActors(projectId: string): Promise<StoredActor[]> {
    const actors = await this.prisma.actor.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return actors.map(storedActor);
  }

  async saveActor(actor: StoredActor): Promise<void> {
    await this.prisma.actor.create({
      data: {
        ...actor,
        aliases: JSON.stringify(actor.aliases),
        archived_at: dateOrNull(actor.archived_at)
      }
    });
  }
}
