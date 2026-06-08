import type { StoredMergeRequest } from "../domain/entities/index.js";
import type {
  StoredLock,
  StoredUseCase,
  StoredWorkSession
} from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type WhoIsWorkingDeps = {
  branchStore: BranchStore;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  mergeRequestStore: MergeRequestStore;
  now?: () => Date;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type WhoSessionRow = {
  agent_type?: StoredWorkSession["agent_type"];
  id: string;
  intent?: string;
  markers: string[];
  started_at?: string;
  user_id?: string;
};
export type WhoLockRow = {
  expires_at: string;
  held_by_session_id: null | string;
  held_by_user_id: string;
  id: string;
  lock_type: string;
};
export type WhoMergeRow = {
  conflict_count: number;
  id: string;
  source_branch_id: null | string;
  status: StoredMergeRequest["status"];
};

export type WhoIsWorkingResult =
  | {
      archived?: true;
      locks: WhoLockRow[];
      mergeRequests: WhoMergeRow[];
      sessions: WhoSessionRow[];
      status: "FOUND";
      suggestedNextActions: Array<{ command: string; reason: string }>;
      usecase: { id: string; key: string };
    }
  | { missingUsecaseId: string; status: "USECASE_NOT_FOUND" }
  | { status: "FORBIDDEN" };

export async function whoIsWorking(
  deps: WhoIsWorkingDeps,
  input: { usecaseId: string; userId: string | undefined }
): Promise<WhoIsWorkingResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { missingUsecaseId: input.usecaseId, status: "USECASE_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }

  // ⚡ Bolt: Parallelized async queries to reduce overall latency.
  // Expected impact: Total fetch time reduced to the longest individual query,
  // rather than the sum of all three queries.
  const [activeSessionsData, activeLocksData, openMergeRequestsData] = await Promise.all([
    activeSessions(deps.workSessionStore, found.usecase.id),
    activeLocks(deps, found.usecase.id),
    openMergeRequests(deps, found.usecase.id)
  ]);

  const sessions = activeSessionsData.map((session) => sessionRow(deps, session));
  const locks = activeLocksData.map(lockRow);
  const mergeRequests = openMergeRequestsData.map(mergeRow);
  const hasActiveWork = sessions.length + locks.length + mergeRequests.length > 0;

  return {
    ...(found.usecase.archived_at === null ? {} : { archived: true as const }),
    locks,
    mergeRequests,
    sessions,
    status: "FOUND",
    suggestedNextActions: nextActions(
      mergeRequests,
      found.usecase,
      hasActiveWork,
      sessions
    ),
    usecase: { id: found.usecase.id, key: found.usecase.key }
  };
}

async function activeSessions(workSessionStore: WorkSessionStore, usecaseId: string) {
  return (await workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .filter((session) => session.status === "ACTIVE")
    .filter((session) => session.pinned_revisions?.[usecaseId] !== undefined);
}

async function activeLocks(deps: WhoIsWorkingDeps, usecaseId: string) {
  const nowTime = now(deps).getTime();
  return (await deps.lockStore.listLocksForUseCase(usecaseId)).filter(
    (lock) => Date.parse(lock.expires_at) >= nowTime
  );
}

async function openMergeRequests(deps: WhoIsWorkingDeps, usecaseId: string) {
  const matches = await Promise.all(
    (await deps.mergeRequestStore.listOpenMergeRequests()).map(async (merge) => ({
      merge,
      touches:
        (await branchTouches(deps.branchStore, merge.source_branch_id, usecaseId)) ||
        (await branchTouches(deps.branchStore, merge.target_branch_id, usecaseId))
    }))
  );
  return matches.filter((match) => match.touches).map((match) => match.merge);
}

function sessionRow(deps: WhoIsWorkingDeps, session: StoredWorkSession): WhoSessionRow {
  return {
    agent_type: session.agent_type,
    id: session.id,
    intent: session.intent,
    markers: sessionMarkers(deps, session),
    started_at: session.started_at,
    user_id: session.user_id
  };
}

function lockRow(lock: StoredLock): WhoLockRow {
  return {
    expires_at: lock.expires_at,
    held_by_session_id: lock.held_by_session_id ?? null,
    held_by_user_id: lock.held_by_user_id ?? "",
    id: lock.id ?? lock.usecase_id,
    lock_type: lock.lock_type ?? lock.mode
  };
}

function mergeRow(merge: StoredMergeRequest): WhoMergeRow {
  return {
    conflict_count: merge.conflicts.length,
    id: merge.id,
    source_branch_id: merge.source_branch_id,
    status: merge.status
  };
}

function nextActions(
  merges: WhoMergeRow[],
  usecase: StoredUseCase,
  hasActiveWork: boolean,
  sessions: WhoSessionRow[]
) {
  if (!hasActiveWork) {
    return [
      {
        command: `vspec session start --intent "..." --pin ${usecase.key}`,
        reason: "Start a session on this use case."
      }
    ];
  }
  return [
    ...(usecase.archived_at !== null
      ? [
          {
            command: `vspec usecase restore ${usecase.key}`,
            reason: "Restore the archived use case before coordinating active work."
          }
        ]
      : []),
    ...merges.map((merge) => ({
      command: `vspec merge show ${merge.id}`,
      reason: "Review the open merge request touching this use case."
    })),
    ...sessions
      .filter((session) => session.markers.includes("ZOMBIE"))
      .map((session) => ({
        command: `vspec session abandon ${session.id}`,
        reason: "Review and explicitly abandon the stale active session."
      }))
  ];
}

function sessionMarkers(deps: WhoIsWorkingDeps, session: StoredWorkSession): string[] {
  return idleSeconds(deps, session.last_activity_at ?? session.started_at) > 1800
    ? ["ZOMBIE"]
    : [];
}

function idleSeconds(deps: WhoIsWorkingDeps, startedAt: string | undefined): number {
  return Math.max(
    0,
    Math.floor((now(deps).getTime() - Date.parse(startedAt ?? "")) / 1000)
  );
}

async function branchTouches(
  branchStore: BranchStore,
  branchId: null | string,
  usecaseId: string
): Promise<boolean> {
  return (
    branchId !== null &&
    (await branchStore.findBranchById(branchId))?.head_revision_ids?.[usecaseId] !==
      undefined
  );
}

function now(deps: WhoIsWorkingDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
