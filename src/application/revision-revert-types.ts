import type {
  StoredLock,
  StoredRevision,
  StoredUseCase
} from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type RevisionRevertDeps = {
  branchStore: BranchStore;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type RevisionRevertInput = {
  force: boolean;
  revisionId: string;
  simulateGherkinDrift: boolean;
  simulateWriteFailure: boolean;
  usecaseId: string;
  userId: string | undefined;
};

export type RevisionRevertImpact = {
  affected_branches: string[];
  affected_sessions: string[];
  severity: StoredRevision["severity"];
};

export type RevisionRevertResult =
  | { status: "USECASE_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | { lock: StoredLock; status: "HARD_LOCKED"; usecase: StoredUseCase }
  | { revisionId: string; status: "TARGET_REVISION_NOT_FOUND"; usecase: StoredUseCase }
  | { status: "CURRENT_REVISION_NOT_FOUND" }
  | {
      affectedSessions: string[];
      currentRevision: StoredRevision;
      status: "BREAKING_REVERT";
      targetRevisionId: string;
      usecase: StoredUseCase;
    }
  | { status: "WRITE_FAILED"; targetRevisionId: string; usecase: StoredUseCase }
  | {
      impact: RevisionRevertImpact;
      revision: StoredRevision;
      status: "REVERTED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
      usecase: StoredUseCase;
      warnings?: Array<{ message: string; type: string }>;
    };
