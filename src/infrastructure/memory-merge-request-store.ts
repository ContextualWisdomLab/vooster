import type { StoredMergeRequest } from "../http/merge-request-types.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";

export function createMemoryMergeRequestStore(): MergeRequestStore {
  const mergeRequestsById = new Map<string, StoredMergeRequest>();

  return {
    findMergeRequestById(mergeRequestId) {
      return Promise.resolve(mergeRequestsById.get(mergeRequestId));
    },

    listOpenMergeRequests() {
      return Promise.resolve(openMergeRequests());
    },

    listOpenMergeRequestsByTargetBranchId(targetBranchId) {
      return Promise.resolve(
        openMergeRequests().filter(
          (mergeRequest) => mergeRequest.target_branch_id === targetBranchId
        )
      );
    },

    saveMergeRequest(mergeRequest) {
      mergeRequestsById.set(mergeRequest.id, mergeRequest);
      return Promise.resolve();
    },

    updateMergeRequest(mergeRequest) {
      mergeRequestsById.set(mergeRequest.id, mergeRequest);
      return Promise.resolve();
    }
  };

  function openMergeRequests() {
    return [...mergeRequestsById.values()].filter(
      (mergeRequest) => mergeRequest.status === "OPEN"
    );
  }
}
