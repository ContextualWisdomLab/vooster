import type { StoredLock, StoredUseCase } from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type UseCaseArchiveInput = {
  hardDeleteRequested: boolean;
  usecaseId: string;
  userId: string | undefined;
};

export type UseCaseArchiveDeps = {
  branchStore: BranchStore;
  clock?: () => string;
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type RevisionSummary = {
  change_summary: string | undefined;
  id: string;
};

export type UseCaseArchiveResult =
  | { status: "USECASE_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | { status: "HARD_DELETE_REQUESTED"; usecase: StoredUseCase }
  | { status: "ALREADY_ARCHIVED"; usecase: StoredUseCase }
  | {
      expiresAt: string;
      holdingSession: string;
      lock: StoredLock;
      status: "HARD_LOCKED";
    }
  | {
      activeLocksCount: number;
      affectedSessions: Array<{ id: string; pinned_revision: string }>;
      revision: RevisionSummary;
      status: "ARCHIVED";
      usecase: { archived_at: string; id: string; key: string };
    };

export type UseCaseRestoreResult =
  | { status: "USECASE_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | { status: "NOT_ARCHIVED" }
  | {
      revision: RevisionSummary;
      status: "RESTORED";
      usecase: { archived_at: null; id: string; key: string };
    };
