import type { StoredActor } from "../domain/entities/index.js";

export type ActorStore = {
  archiveActor: (
    projectId: string,
    actorId: string,
    archivedAt: string
  ) => Promise<boolean>;
  findActorById: (
    projectId: string,
    actorId: string
  ) => Promise<StoredActor | undefined>;
  findActorByName: (
    projectId: string,
    name: string
  ) => Promise<StoredActor | undefined>;
  listActors: (projectId: string) => Promise<StoredActor[]>;
  saveActor: (actor: StoredActor) => Promise<void>;
  updateActor?: (actor: StoredActor) => Promise<void>;
};
