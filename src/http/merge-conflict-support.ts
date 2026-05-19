import type { SignupState, StoredSpecBranch } from "./signup-types.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type ExtensionChange = { condition: string; extension_point: string };

export function mergeConflicts(
  state: SignupState,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  return [
    ...structuralConflicts(state, source, targetHeads, touched),
    ...semanticConflicts(state, source, targetHeads, touched)
  ];
}

export function hardLockConflict(state: SignupState, touched: string[]) {
  return touched
    .map((entityId) => state.stepLocksByUseCaseId.get(entityId))
    .find((lock) => lock?.mode === "HARD");
}

export async function useCaseKey(
  useCaseStore: UseCaseStore,
  usecaseId: string
): Promise<string> {
  return (await useCaseStore.findUseCaseWithProject(usecaseId))?.usecase.key ?? usecaseId;
}

function structuralConflicts(
  state: SignupState,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  return touched
    .filter((entityId) => source.base_revision_ids?.[entityId] !== targetHeads[entityId])
    .flatMap((entityId) => {
      const mine = titleAtRevision(state, source.head_revision_ids?.[entityId] ?? "");
      const theirs = titleAtRevision(state, targetHeads[entityId] ?? "");
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
}

function semanticConflicts(
  state: SignupState,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  return touched
    .filter((entityId) => source.base_revision_ids?.[entityId] !== targetHeads[entityId])
    .flatMap((entityId) => {
      const mine = extensionAtRevision(state, source.head_revision_ids?.[entityId] ?? "");
      const theirs = extensionAtRevision(state, targetHeads[entityId] ?? "");
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
}

function titleAtRevision(state: SignupState, revisionId: string): string | undefined {
  const snapshot = revisionById(state, revisionId)?.snapshot;
  return snapshot !== undefined && "title" in snapshot ? snapshot.title : undefined;
}

function extensionAtRevision(state: SignupState, revisionId: string): ExtensionChange | undefined {
  const summary = revisionById(state, revisionId)?.change_summary;
  if (summary === undefined || !summary.startsWith("extension:")) {
    return undefined;
  }
  const [, extensionPoint, ...condition] = summary.split(":");
  return { extension_point: extensionPoint ?? "", condition: condition.join(":") };
}

function revisionById(state: SignupState, revisionId: string) {
  return [...state.revisionsByEntityId.values()]
    .flat()
    .find((revision) => revision.id === revisionId);
}
