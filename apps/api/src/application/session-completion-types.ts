import type { StoredMergeRequest } from "../domain/entities/index.js";
import type { StoredWorkSession } from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type CompleteSessionInput = {
  noMerge: boolean;
  sessionId: string;
  simulateCompletionFailure: boolean;
  simulateConflicts: boolean;
  simulateFailedLockRelease?: string;
  userId: string | undefined;
};

export type CompleteSessionDeps = {
  branchStore: BranchStore;
  clock?: () => string;
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  mergeRequestStore: MergeRequestStore;
  projectStore: ProjectStore;
  workSessionStore: WorkSessionStore;
};

export type LockRelease = {
  releasedLockIds: string[];
  warnings: Array<{ lock_id: string; message: string; type: "LOCK_RELEASE_FAILED" }>;
};

export type CompleteSessionResult =
  | { status: "SESSION_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | {
      currentStatus: StoredWorkSession["status"];
      sessionId: string;
      status: "SESSION_NOT_ACTIVE";
    }
  | { exitCode: 5; status: "COMPLETION_FAILED" }
  | {
      mergeRequest?: StoredMergeRequest;
      releasedLockIds: string[];
      session: StoredWorkSession;
      status: "COMPLETED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
      warnings: LockRelease["warnings"];
    };
