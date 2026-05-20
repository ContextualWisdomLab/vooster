import { randomUUID } from "node:crypto";
import type { MergeResolution, ResolveMergeDeps } from "./merge-resolution-types.js";
import type { StoredRevision, StoredUseCase } from "../http/signup-types.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function manualResolutionMissingValue(resolutions: MergeResolution[]) {
  return resolutions.find(
    (resolution) => resolution.strategy === "MANUAL" && resolution.value === undefined
  );
}

export function uncoveredConflicts(
  conflicts: Array<Record<string, unknown>>,
  resolutions: MergeResolution[]
) {
  return conflicts.filter(
    (conflict) =>
      !resolutions.some(
        (resolution) => resolution.entity_id === String(conflict.entity_id)
      )
  );
}

export async function resolvedRevisions(
  deps: Pick<ResolveMergeDeps, "idFactory" | "revisionStore" | "useCaseStore">,
  conflicts: Array<Record<string, unknown>>,
  resolutions: MergeResolution[]
): Promise<StoredRevision[]> {
  return Promise.all(
    conflicts.map(async (conflict) => {
      const entityId = String(conflict.entity_id);
      const found = await deps.useCaseStore.findUseCaseWithProject(entityId);
      const title = resolvedTitle(
        conflict,
        resolutions.find((item) => item.entity_id === entityId)
      );
      if (found === undefined || title === undefined) {
        throw new Error("Unsupported conflict resolution");
      }
      found.usecase.title = title;
      const revision = await useCaseRevision(deps, found.usecase);
      found.usecase.current_revision_id = revision.id;
      await deps.useCaseStore.updateUseCase(found.usecase);
      return revision;
    })
  );
}

export async function nextActions(
  useCaseStore: UseCaseStore,
  revisions: StoredRevision[]
) {
  return Promise.all(
    revisions.map(async (revision) => ({
      command: `vspec usecase show ${
        (await useCaseStore.findUseCaseWithProject(revision.entity_id))?.usecase.key ??
        revision.entity_id
      }`,
      reason: "Review the resolved use case on main."
    }))
  );
}

function resolvedTitle(
  conflict: Record<string, unknown>,
  resolution: MergeResolution | undefined
): string | undefined {
  if (resolution?.strategy === "THEIRS" && typeof conflict.mine_value === "string") {
    return conflict.mine_value;
  }
  if (resolution?.strategy === "MINE" && typeof conflict.theirs_value === "string") {
    return conflict.theirs_value;
  }
  return typeof resolution?.value === "string" ? resolution.value : undefined;
}

async function useCaseRevision(
  deps: Pick<ResolveMergeDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase
): Promise<StoredRevision> {
  return {
    id: (deps.idFactory ?? randomUUID)(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase },
    change_summary: "Resolved merge conflict",
    severity: "BREAKING"
  };
}
