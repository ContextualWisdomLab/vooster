import type { StoredStakeholder } from "../domain/entities/index.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";

export function createMemoryStakeholderStore(): StakeholderStore {
  const stakeholdersByProjectId = new Map<string, StoredStakeholder[]>();

  return {
    findStakeholderById(projectId, stakeholderId) {
      return Promise.resolve(
        (stakeholdersByProjectId.get(projectId) ?? []).find(
          (stakeholder) => stakeholder.id === stakeholderId
        )
      );
    },

    findStakeholderByName(projectId, name) {
      return Promise.resolve(
        (stakeholdersByProjectId.get(projectId) ?? []).find(
          (stakeholder) => stakeholder.name === name
        )
      );
    },

    listStakeholders(projectId) {
      return Promise.resolve(stakeholdersByProjectId.get(projectId) ?? []);
    },

    saveStakeholder(stakeholder) {
      stakeholdersByProjectId.set(stakeholder.project_id, [
        ...(stakeholdersByProjectId.get(stakeholder.project_id) ?? []),
        stakeholder
      ]);
      return Promise.resolve();
    }
  };
}
