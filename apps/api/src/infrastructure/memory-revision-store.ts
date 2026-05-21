import type { StoredRevision } from "../domain/entities/index.js";
import type { RevisionStore } from "../ports/revision-store.js";

export function createMemoryRevisionStore(): RevisionStore {
  const revisionsByEntityId = new Map<string, StoredRevision[]>();

  return {
    findRevisionById(revisionId) {
      return Promise.resolve(
        [...revisionsByEntityId.values()]
          .flat()
          .find((revision) => revision.id === revisionId)
      );
    },

    latestRevision(entityId) {
      return Promise.resolve(revisionsByEntityId.get(entityId)?.at(-1));
    },

    listRevisions(entityId) {
      return Promise.resolve(revisionsByEntityId.get(entityId) ?? []);
    },

    nextVersionNumber(entityId) {
      return Promise.resolve((revisionsByEntityId.get(entityId) ?? []).length + 1);
    },

    saveRevision(revision) {
      revisionsByEntityId.set(revision.entity_id, [
        ...(revisionsByEntityId.get(revision.entity_id) ?? []),
        revision
      ]);
      return Promise.resolve();
    }
  };
}
