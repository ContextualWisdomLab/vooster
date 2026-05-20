import { hardLockConflict, useCaseKey } from "./merge-conflicts.js";
import {
  manualResolutionMissingValue,
  nextActions,
  resolvedRevisions,
  uncoveredConflicts
} from "./merge-resolution-revisions.js";
import type {
  ResolveMergeDeps,
  ResolveMergeInput,
  ResolveMergeResult
} from "./merge-resolution-types.js";
import type { StoredMergeRequest } from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
export type {
  ResolveMergeInput,
  ResolveMergeResult
} from "./merge-resolution-types.js";

export async function resolveMerge(
  deps: ResolveMergeDeps,
  input: ResolveMergeInput
): Promise<ResolveMergeResult> {
  const merge = await deps.mergeRequestStore.findMergeRequestById(input.mergeId);
  if (merge === undefined) {
    return { status: "MERGE_NOT_FOUND" };
  }
  const source = await branchById(deps.branchStore, merge.source_branch_id);
  const target = await branchById(deps.branchStore, merge.target_branch_id);
  if (source === undefined || target === undefined) {
    return { status: "BRANCH_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(
      source.project_id,
      input.userId
    )) === undefined
  ) {
    return { status: "ACCESS_DENIED" };
  }
  if (merge.status !== "OPEN" || merge.conflicts.length === 0) {
    return { mergeRequest: merge, status: "NO_OPEN_CONFLICTS" };
  }
  if (input.baseRevision !== merge.current_revision_id) {
    return { mergeRequest: merge, status: "STALE_BASE" };
  }
  const missingManualValue = manualResolutionMissingValue(input.resolutions);
  if (missingManualValue !== undefined) {
    return {
      mergeRequest: merge,
      resolution: missingManualValue,
      status: "MISSING_MANUAL_VALUE"
    };
  }
  const uncovered = uncoveredConflicts(merge.conflicts, input.resolutions);
  if (uncovered.length > 0) {
    return { mergeRequest: merge, status: "UNCOVERED_CONFLICTS", uncovered };
  }

  const mainHeadRevisionIds = target.head_revision_ids ?? {};
  const hardLock = await hardLockConflict(deps.lockStore, conflictEntityIds(merge));
  if (hardLock !== undefined) {
    return {
      holdingSession: hardLock.holder,
      mainHeadRevisionIds,
      mergeRequest: merge,
      status: "HARD_LOCK",
      useCaseKey: await useCaseKey(deps.useCaseStore, hardLock.usecase_id)
    };
  }
  if (input.simulateWriteFailure) {
    return {
      exitCode: 5,
      mainHeadRevisionIds,
      mergeRequest: merge,
      sourceBranch: source,
      status: "WRITE_FAILED"
    };
  }

  const newRevisions = await resolvedRevisions(
    deps,
    merge.conflicts,
    input.resolutions
  );
  for (const revision of newRevisions) {
    await deps.revisionStore.saveRevision(revision);
  }
  target.head_revision_ids = {
    ...mainHeadRevisionIds,
    ...Object.fromEntries(
      newRevisions.map((revision) => [revision.entity_id, revision.id])
    )
  };
  merge.conflicts = [];
  merge.status = "MERGED";
  merge.resolved_at = now(deps).toISOString();
  source.status = "MERGED";
  source.merged_at = merge.resolved_at;
  await deps.branchStore.updateBranch(target);
  await deps.branchStore.updateBranch(source);
  await deps.mergeRequestStore.updateMergeRequest(merge);

  return {
    mainHeadRevisionIds: target.head_revision_ids,
    mergeRequest: merge,
    newRevisions,
    sourceBranch: source,
    status: "MERGED",
    suggestedNextActions: await nextActions(deps.useCaseStore, newRevisions)
  };
}

function conflictEntityIds(merge: StoredMergeRequest) {
  return merge.conflicts.map((conflict) => String(conflict.entity_id));
}

function branchById(branchStore: BranchStore, branchId: null | string) {
  return branchId === null
    ? Promise.resolve(undefined)
    : branchStore.findBranchById(branchId);
}

function now(deps: ResolveMergeDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
