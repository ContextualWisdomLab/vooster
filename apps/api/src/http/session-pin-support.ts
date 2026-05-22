import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { StoredUseCase } from "../domain/entities/index.js";
import type { LockStore } from "../ports/lock-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
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
  lockStore: LockStore,
  revisionStore: RevisionStore,
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
    const lock = await lockStore.findLockForUseCase(usecase.id);
    if (lock?.mode === "HARD") {
      return { holder: lock.holder, key, status: "HARD_LOCKED" };
    }
    resolved.push(usecase);
  }

  return {
    status: "OK",
    keys,
    revisions: await pinnedRevisions(revisionStore, resolved),
    usecases: resolved
  };
}

async function pinnedRevisions(
  revisionStore: RevisionStore,
  usecases: StoredUseCase[]
): Promise<Record<string, string>> {
  const revisions: Record<string, string> = {};
  for (const usecase of usecases) {
    revisions[usecase.id] = await latestRevisionId(revisionStore, usecase);
  }
  return revisions;
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

export async function semanticLockConflict(
  lockStore: LockStore,
  pinned: PinnedUseCases
): Promise<{ holder: string; key: string } | undefined> {
  for (const usecase of pinned.usecases) {
    const lock = await lockStore.findLockForUseCase(usecase.id);
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

async function latestRevisionId(
  revisionStore: RevisionStore,
  usecase: StoredUseCase
): Promise<string> {
  return (
    (await revisionStore.latestRevision(usecase.id))?.id ?? usecase.current_revision_id
  );
}
