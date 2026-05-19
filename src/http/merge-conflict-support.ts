import type { LockStore } from "../ports/lock-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { StoredSpecBranch } from "./signup-types.js";

type ExtensionChange = { condition: string; extension_point: string };

export async function mergeConflicts(
  revisionStore: RevisionStore,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
): Promise<Array<Record<string, unknown>>> {
  return [
    ...await structuralConflicts(revisionStore, source, targetHeads, touched),
    ...await semanticConflicts(revisionStore, source, targetHeads, touched)
  ];
}

export async function hardLockConflict(lockStore: LockStore, touched: string[]) {
  for (const entityId of touched) {
    const lock = await lockStore.findLockForUseCase(entityId);
    if (lock?.mode === "HARD") {
      return lock;
    }
  }

  return undefined;
}

export async function useCaseKey(
  useCaseStore: UseCaseStore,
  usecaseId: string
): Promise<string> {
  return (await useCaseStore.findUseCaseWithProject(usecaseId))?.usecase.key ?? usecaseId;
}

async function structuralConflicts(
  revisionStore: RevisionStore,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  const candidates = touched
    .filter((entityId) => source.base_revision_ids?.[entityId] !== targetHeads[entityId])
    .map(async (entityId) => {
      const mine = await titleAtRevision(
        revisionStore,
        source.head_revision_ids?.[entityId] ?? ""
      );
      const theirs = await titleAtRevision(revisionStore, targetHeads[entityId] ?? "");
      return mine !== undefined && theirs !== undefined && mine !== theirs
        ? [{
            entity_id: entityId,
            entity_type: "USECASE",
            field: "title",
            mine_value: mine,
            theirs_value: theirs,
            type: "STRUCTURAL"
          }]
        : [];
    });
  return (await Promise.all(candidates)).flat();
}

async function semanticConflicts(
  revisionStore: RevisionStore,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  const candidates = touched
    .filter((entityId) => source.base_revision_ids?.[entityId] !== targetHeads[entityId])
    .map(async (entityId) => {
      const mine = await extensionAtRevision(
        revisionStore,
        source.head_revision_ids?.[entityId] ?? ""
      );
      const theirs = await extensionAtRevision(revisionStore, targetHeads[entityId] ?? "");
      return mine !== undefined &&
        theirs !== undefined &&
        mine.extension_point === theirs.extension_point &&
        mine.condition !== theirs.condition
        ? [{
            entity_id: entityId,
            extension_point: mine.extension_point,
            mine_scenario: mine.condition,
            theirs_scenario: theirs.condition,
            type: "SEMANTIC"
          }]
        : [];
    });
  return (await Promise.all(candidates)).flat();
}

async function titleAtRevision(
  revisionStore: RevisionStore,
  revisionId: string
): Promise<string | undefined> {
  const snapshot = (await revisionStore.findRevisionById(revisionId))?.snapshot;
  return snapshot !== undefined && "title" in snapshot ? snapshot.title : undefined;
}

async function extensionAtRevision(
  revisionStore: RevisionStore,
  revisionId: string
): Promise<ExtensionChange | undefined> {
  const summary = (await revisionStore.findRevisionById(revisionId))?.change_summary;
  if (summary === undefined || !summary.startsWith("extension:")) {
    return undefined;
  }
  const [, extensionPoint, ...condition] = summary.split(":");
  return { extension_point: extensionPoint ?? "", condition: condition.join(":") };
}
