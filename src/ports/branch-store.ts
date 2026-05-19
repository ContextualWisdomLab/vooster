import type { StoredSpecBranch } from "../http/signup-types.js";

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
