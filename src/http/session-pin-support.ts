import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type PinnedUseCases = {
  status: "OK";
  keys: string[];
  revisions: Record<string, string>;
  usecases: StoredUseCase[];
};
export type PinResolution =
  | PinnedUseCases
  | { holder: string; key: string; status: "HARD_LOCKED" }
  | { key: string; status: "ARCHIVED" | "MISSING" };

export async function resolvePins(
  state: SignupState,
  useCaseStore: UseCaseStore,
  projectId: string,
  keys: string[]
): Promise<PinResolution> {
  const usecases = await useCaseStore.listUseCases(projectId);
  const resolved: StoredUseCase[] = [];
  for (const key of keys) {
    const usecase = usecases.find((candidate) => candidate.key === key);
    if (usecase === undefined) {
      return { key, status: "MISSING" };
    }
    if (usecase.archived_at !== null) {
      return { key, status: "ARCHIVED" };
    }
    const lock = state.stepLocksByUseCaseId.get(usecase.id);
    if (lock?.mode === "HARD") {
      return { holder: lock.holder, key, status: "HARD_LOCKED" };
    }
    resolved.push(usecase);
  }

  return {
    status: "OK",
    keys,
    revisions: Object.fromEntries(
      resolved.map((usecase) => [usecase.id, latestRevisionId(state, usecase)])
    ),
    usecases: resolved
  };
}

export function archivedPinProblem(key: string) {
  return problem(
    422,
    "Pinned use case is archived",
    { offending_key: key, session_count: 0 },
    [
      {
        command: `vspec usecase restore ${key}`,
        reason: "Restore the archived use case before pinning it."
      }
    ]
  );
}

export function hardLockedPinProblem(key: string, holder: string) {
  return problem(
    409,
    "Pinned use case is hard-locked",
    { holding_session: holder, offending_key: key },
    [
      {
        command: `vspec who ${key}`,
        reason: "Identify the session holding the hard lock."
      }
    ]
  );
}

export function semanticLockConflict(
  state: SignupState,
  pinned: PinnedUseCases
): { holder: string; key: string } | undefined {
  for (const usecase of pinned.usecases) {
    const lock = state.stepLocksByUseCaseId.get(usecase.id);
    if (lock?.mode === "SEMANTIC") {
      return { holder: lock.holder, key: usecase.key };
    }
  }

  return undefined;
}

export function semanticLockProblem(key: string, holder: string) {
  return problem(
    409,
    "Pinned use case has a semantic lock",
    { conflicting_session: holder, created_branch: false, created_session: false },
    [
      {
        command: `vspec who ${key}`,
        reason: "Identify the session holding the semantic lock."
      }
    ]
  );
}

function latestRevisionId(state: SignupState, usecase: StoredUseCase): string {
  const revisions = state.revisionsByEntityId.get(usecase.id) ?? [];
  return revisions[revisions.length - 1]?.id ?? usecase.current_revision_id;
}
