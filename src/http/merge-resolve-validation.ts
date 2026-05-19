import { problem } from "./signup-support.js";
import type { SignupState, StoredLock, StoredSpecBranch } from "./signup-types.js";
import type { StoredMergeRequest } from "./merge-request-types.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type MergeResolution = {
  entity_id: string;
  field?: string;
  strategy: string;
  value?: unknown;
};

export function manualResolutionMissingValue(resolutions: MergeResolution[]) {
  return resolutions.find(
    (resolution) => resolution.strategy === "MANUAL" && resolution.value === undefined
  );
}

export function uncoveredConflicts(
  conflicts: Array<Record<string, unknown>>,
  resolutions: MergeResolution[]
) {
  return conflicts.filter((conflict) =>
    !resolutions.some((resolution) => resolution.entity_id === String(conflict.entity_id))
  );
}

export function staleBaseProblem(merge: StoredMergeRequest) {
  return problem(
    409,
    "Merge request base revision is stale",
    { conflicts: merge.conflicts, current_revision: merge.current_revision_id },
    [
      {
        command: `vspec merge show ${merge.id}`,
        reason: "Reload the current conflict list before resolving."
      }
    ]
  );
}

export function missingManualValueProblem(merge: StoredMergeRequest, resolution: MergeResolution) {
  return problem(
    400,
    "Manual resolution requires a value",
    { field: resolution.field, offending_entity_id: resolution.entity_id },
    [
      {
        command: `vspec merge show ${merge.id}`,
        reason: "Review the original conflict before resolving manually."
      }
    ]
  );
}

export function uncoveredConflictsProblem(
  merge: StoredMergeRequest,
  uncovered: Array<Record<string, unknown>>
) {
  return problem(
    422,
    "Resolution list must cover every conflict",
    { uncovered_conflicts: uncovered },
    [
      {
        command: `vspec merge resolve ${merge.id} --all`,
        reason: "Submit one resolution for each outstanding conflict."
      }
    ]
  );
}

export async function hardLockResolutionProblem(
  state: SignupState,
  useCaseStore: UseCaseStore,
  merge: StoredMergeRequest,
  mainHeadRevisionIds: Record<string, string>,
  lock: StoredLock
) {
  return problem(
    409,
    "Target entity has a hard lock",
    {
      holding_session: lock.holder,
      main_head_revision_ids: mainHeadRevisionIds,
      merge_request: merge
    },
    [
      {
        command: `vspec who ${
          (await useCaseStore.findUseCaseWithProject(lock.usecase_id))?.usecase.key ??
            lock.usecase_id
        }`,
        reason: "Inspect the session holding the hard lock."
      }
    ]
  );
}

export function resolutionWriteFailureProblem(
  merge: StoredMergeRequest,
  source: StoredSpecBranch,
  mainHeadRevisionIds: Record<string, string>
) {
  return problem(
    500,
    "Conflict resolution write failed",
    {
      exit_code: 5,
      main_head_revision_ids: mainHeadRevisionIds,
      merge_request: merge,
      source_branch: source
    },
    [
      {
        command: `vspec merge resolve ${merge.id} --retry`,
        reason: "Retry after the failed conflict resolution."
      }
    ]
  );
}
