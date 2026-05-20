import { randomUUID } from "node:crypto";
import type {
  CompleteSessionDeps,
  CompleteSessionInput,
  CompleteSessionResult,
  LockRelease
} from "./session-completion-types.js";
import type { StoredMergeRequest } from "../http/merge-request-types.js";
import type { StoredLock, StoredWorkSession } from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
export type {
  CompleteSessionInput,
  CompleteSessionResult
} from "./session-completion-types.js";

export async function completeSession(
  deps: CompleteSessionDeps,
  input: CompleteSessionInput
): Promise<CompleteSessionResult> {
  const session = await deps.workSessionStore.findWorkSessionById(input.sessionId);
  if (session === undefined) {
    return { status: "SESSION_NOT_FOUND" };
  }
  if (!(await canCompleteSession(deps, input.userId, session))) {
    return { status: "FORBIDDEN" };
  }
  if (session.status !== "ACTIVE") {
    return {
      currentStatus: session.status,
      sessionId: session.id,
      status: "SESSION_NOT_ACTIVE"
    };
  }
  if (input.simulateCompletionFailure) {
    return { exitCode: 5, status: "COMPLETION_FAILED" };
  }

  const lockRelease = await releaseSessionLocks(
    deps.lockStore,
    session.id,
    input.simulateFailedLockRelease
  );
  const completedAt = (deps.clock ?? (() => new Date().toISOString()))();
  session.status = "COMPLETED";
  session.ended_at = completedAt;
  session.last_activity_at = completedAt;
  const mergeRequest =
    session.branch_id === null || input.noMerge
      ? undefined
      : await openMergeRequest(deps, session, input.simulateConflicts);
  if (mergeRequest !== undefined) {
    await deps.mergeRequestStore.saveMergeRequest(mergeRequest);
  }
  await deps.workSessionStore.updateWorkSession(session);

  return {
    mergeRequest,
    releasedLockIds: lockRelease.releasedLockIds,
    session,
    status: "COMPLETED",
    suggestedNextActions: nextActions(
      mergeRequest,
      input.noMerge ? await branchName(deps.branchStore, session) : undefined
    ),
    warnings: lockRelease.warnings
  };
}

async function canCompleteSession(
  deps: Pick<CompleteSessionDeps, "membershipStore" | "projectStore">,
  userId: string | undefined,
  session: StoredWorkSession
): Promise<boolean> {
  if (userId === undefined || session.project_id === undefined) {
    return false;
  }
  const project = await deps.projectStore.findProjectById(session.project_id);
  if (session.user_id === userId) {
    return true;
  }
  return (
    project !== undefined &&
    (await deps.membershipStore.membershipForWorkspace(
      project.workspace_id,
      userId
    )) !== undefined
  );
}

async function releaseSessionLocks(
  lockStore: LockStore,
  sessionId: string,
  failedLockId: string | undefined
): Promise<LockRelease> {
  const releasedLockIds: string[] = [];
  const warnings: LockRelease["warnings"] = [];
  for (const lock of await lockStore.listLocksHeldBySession(sessionId)) {
    const lockId = lock.id ?? lock.usecase_id;
    await lockStore.deleteLock(lockId);
    if (isFailedRelease(lock, failedLockId)) {
      warnings.push({
        lock_id: lockId,
        message: "Lock was already released before completion.",
        type: "LOCK_RELEASE_FAILED"
      });
    } else {
      releasedLockIds.push(lockId);
    }
  }
  return { releasedLockIds, warnings };
}

async function openMergeRequest(
  deps: Pick<CompleteSessionDeps, "idFactory" | "projectStore">,
  session: StoredWorkSession,
  withConflicts: boolean
): Promise<StoredMergeRequest> {
  const project =
    session.project_id === undefined
      ? undefined
      : await deps.projectStore.findProjectById(session.project_id);
  const conflicts = withConflicts
    ? pinnedEntityIds(session).map((entityId) => ({
        entity_id: entityId,
        type: "SEMANTIC"
      }))
    : [];
  return {
    id: id(deps),
    current_revision_id: id(deps),
    source_branch_id: session.branch_id ?? null,
    target_branch_id: project?.default_branch_id ?? "",
    status: "OPEN",
    strategy: "FAST_FORWARD",
    created_by: session.user_id ?? "",
    impact: {
      affected_sessions: [],
      affected_branches: [],
      severity_by_entity: Object.fromEntries(
        pinnedEntityIds(session).map((entityId) => [entityId, "NON_BREAKING"])
      )
    },
    conflicts
  };
}

function nextActions(mergeRequest: StoredMergeRequest | undefined, branch?: string) {
  if (mergeRequest !== undefined) {
    const hasConflicts = mergeRequest.conflicts.length > 0;
    return [
      {
        command: hasConflicts
          ? `vspec merge resolve ${mergeRequest.id}`
          : `vspec merge show ${mergeRequest.id}`,
        reason: hasConflicts
          ? "Resolve conflicts before the merge request can be approved."
          : "Review the merge request opened for this completed session."
      }
    ];
  }
  return branch === undefined
    ? []
    : [
        {
          command: `vspec merge open ${branch}`,
          reason: "Open a merge request for the completed branch later."
        }
      ];
}

async function branchName(branchStore: BranchStore, session: StoredWorkSession) {
  return session.branch_id === null || session.branch_id === undefined
    ? undefined
    : (await branchStore.findBranchById(session.branch_id))?.name;
}

function isFailedRelease(lock: StoredLock, failedLockId: string | undefined) {
  return (
    failedLockId !== undefined &&
    (lock.usecase_id === failedLockId || lock.id === failedLockId)
  );
}

function pinnedEntityIds(session: StoredWorkSession) {
  return Object.keys(session.pinned_revisions ?? {});
}

function id(deps: Pick<CompleteSessionDeps, "idFactory">) {
  return (deps.idFactory ?? randomUUID)();
}
