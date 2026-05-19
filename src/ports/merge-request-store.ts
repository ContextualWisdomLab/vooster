import type { StoredMergeRequest } from "../http/merge-request-types.js";

export type MergeRequestStore = {
  findMergeRequestById: (mergeRequestId: string) => Promise<StoredMergeRequest | undefined>;
  listOpenMergeRequests: () => Promise<StoredMergeRequest[]>;
  listOpenMergeRequestsByTargetBranchId: (
    targetBranchId: string
  ) => Promise<StoredMergeRequest[]>;
  saveMergeRequest: (mergeRequest: StoredMergeRequest) => Promise<void>;
  updateMergeRequest: (mergeRequest: StoredMergeRequest) => Promise<void>;
};
