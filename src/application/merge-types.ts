import type { StoredMergeRequest } from "../http/merge-request-types.js";
import type { StoredSpecBranch } from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type MergeDeps = {
  branchStore: BranchStore;
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  mergeRequestStore: MergeRequestStore;
  now?: () => Date;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type OpenMergeInput = {
  simulateWriteFailure: boolean;
  sourceBranchId: string;
  strategy: "FAST_FORWARD" | "SQUASH" | undefined;
  userId: string | undefined;
};

export type OpenMergeResult =
  | { status: "SOURCE_NOT_FOUND" }
  | { status: "ACCESS_DENIED" }
  | { status: "SOURCE_NOT_ACTIVE" }
  | {
      mainHeadRevisionIds: Record<string, string>;
      sourceBranch: StoredSpecBranch;
      status: "FAST_FORWARD_REJECTED";
    }
  | {
      holdingSession: string;
      mergeRequest: StoredMergeRequest;
      status: "HARD_LOCK";
      useCaseKey: string;
    }
  | {
      mainHeadRevisionIds: Record<string, string>;
      mergeRequest: StoredMergeRequest;
      sourceBranch: StoredSpecBranch;
      status: "CONFLICTS";
    }
  | {
      exitCode: 5;
      mainHeadRevisionIds: Record<string, string>;
      mergeRequest: StoredMergeRequest;
      sourceBranch: StoredSpecBranch;
      status: "WRITE_FAILED";
    }
  | {
      mainHeadRevisionIds: Record<string, string>;
      mergeRequest: StoredMergeRequest;
      sourceBranch: StoredSpecBranch;
      status: "MERGED";
    };
