import type { StoredMergeRequest } from "../http/merge-request-types.js";
import type { StoredRevision, StoredSpecBranch } from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type MergeResolution = {
  entity_id: string;
  field?: string;
  strategy: "MANUAL" | "MINE" | "THEIRS";
  value?: unknown;
};

export type ResolveMergeInput = {
  baseRevision: string;
  mergeId: string;
  resolutions: MergeResolution[];
  simulateWriteFailure: boolean;
  userId: string | undefined;
};

export type ResolveMergeDeps = {
  branchStore: BranchStore;
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  mergeRequestStore: MergeRequestStore;
  now?: () => Date;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type ResolveMergeResult =
  | { status: "MERGE_NOT_FOUND" }
  | { status: "BRANCH_NOT_FOUND" }
  | { status: "ACCESS_DENIED" }
  | { mergeRequest: StoredMergeRequest; status: "NO_OPEN_CONFLICTS" }
  | { mergeRequest: StoredMergeRequest; status: "STALE_BASE" }
  | {
      mergeRequest: StoredMergeRequest;
      resolution: MergeResolution;
      status: "MISSING_MANUAL_VALUE";
    }
  | {
      mergeRequest: StoredMergeRequest;
      status: "UNCOVERED_CONFLICTS";
      uncovered: Array<Record<string, unknown>>;
    }
  | {
      holdingSession: string;
      mainHeadRevisionIds: Record<string, string>;
      mergeRequest: StoredMergeRequest;
      status: "HARD_LOCK";
      useCaseKey: string;
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
      newRevisions: StoredRevision[];
      sourceBranch: StoredSpecBranch;
      status: "MERGED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
    };
