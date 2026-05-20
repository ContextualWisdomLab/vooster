import type { StoredSpecBranch } from "../domain/entities/index.js";

export type BranchStore = {
  findBranchById: (branchId: string) => Promise<StoredSpecBranch | undefined>;
  findBranchByProjectAndName: (
    projectId: string,
    name: string
  ) => Promise<StoredSpecBranch | undefined>;
  listBranches: (projectId: string) => Promise<StoredSpecBranch[]>;
  saveBranch: (branch: StoredSpecBranch) => Promise<void>;
  updateBranch: (branch: StoredSpecBranch) => Promise<void>;
};
