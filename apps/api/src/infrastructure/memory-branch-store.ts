import type { BranchStore } from "../ports/branch-store.js";
import type { StoredSpecBranch } from "../domain/entities/index.js";

export function createMemoryBranchStore(): BranchStore {
  const branchesById = new Map<string, StoredSpecBranch>();

  return {
    findBranchById(branchId) {
      return Promise.resolve(branchesById.get(branchId));
    },

    findBranchByProjectAndName(projectId, name) {
      return Promise.resolve(
        [...branchesById.values()].find(
          (branch) => branch.project_id === projectId && branch.name === name
        )
      );
    },

    listBranches(projectId) {
      return Promise.resolve(
        [...branchesById.values()].filter((branch) => branch.project_id === projectId)
      );
    },

    saveBranch(branch) {
      branchesById.set(branch.id, branch);
      return Promise.resolve();
    },

    updateBranch(branch) {
      branchesById.set(branch.id, branch);
      return Promise.resolve();
    }
  };
}
