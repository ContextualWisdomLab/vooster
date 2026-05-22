import type { ActorStore } from "../ports/actor-store.js";
import type { StoredActor } from "../domain/entities/index.js";

export function createMemoryActorStore(): ActorStore {
  const actorsByProjectId = new Map<string, StoredActor[]>();

  return {
    archiveActor(projectId, actorId, archivedAt) {
      const actor = (actorsByProjectId.get(projectId) ?? []).find(
        (candidate) => candidate.id === actorId
      );
      if (actor === undefined) {
        return Promise.resolve(false);
      }

      actor.archived_at = archivedAt;
      return Promise.resolve(true);
    },

    findActorById(projectId, actorId) {
      return Promise.resolve(
        (actorsByProjectId.get(projectId) ?? []).find((actor) => actor.id === actorId)
      );
    },

    findActorByName(projectId, name) {
      return Promise.resolve(
        (actorsByProjectId.get(projectId) ?? []).find((actor) => actor.name === name)
      );
    },

    listActors(projectId) {
      return Promise.resolve(actorsByProjectId.get(projectId) ?? []);
    },

    saveActor(actor) {
      actorsByProjectId.set(actor.project_id, [
        ...(actorsByProjectId.get(actor.project_id) ?? []),
        actor
      ]);
      return Promise.resolve();
    },

    updateActor(actor) {
      actorsByProjectId.set(
        actor.project_id,
        (actorsByProjectId.get(actor.project_id) ?? []).map((candidate) =>
          candidate.id === actor.id ? actor : candidate
        )
      );
      return Promise.resolve();
    }
  };
}
