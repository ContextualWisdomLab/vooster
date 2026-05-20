import { randomUUID } from "node:crypto";
import { hardLockConflict, mergeConflicts, useCaseKey } from "./merge-conflicts.js";
import type { MergeDeps, OpenMergeInput, OpenMergeResult } from "./merge-types.js";
import type { StoredMergeRequest } from "../http/merge-request-types.js";
import type { StoredProject, StoredSpecBranch } from "../http/signup-types.js";
import type { RevisionStore } from "../ports/revision-store.js";
export async function openMerge(
  deps: MergeDeps,
  input: OpenMergeInput
): Promise<OpenMergeResult> {
  const source = await deps.branchStore.findBranchById(input.sourceBranchId);
  const project =
    source === undefined
      ? undefined
      : await deps.projectStore.findProjectById(source.project_id);
  if (source === undefined || project === undefined) {
    return { status: "SOURCE_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(project.id, input.userId)) ===
      undefined
  ) {
    return { status: "ACCESS_DENIED" };
  }

  const target = await deps.branchStore.findBranchById(project.default_branch_id);
  if (target === undefined || source.status !== "ACTIVE") {
    return { status: "SOURCE_NOT_ACTIVE" };
  }

  const targetHeads = await mainHeadRevisions(deps, project, target);
  const touched = touchedEntityIds(source, targetHeads);
  const hardLock = await hardLockConflict(deps.lockStore, touched);
  const conflicts = await mergeConflicts(
    deps.revisionStore,
    source,
    targetHeads,
    touched
  );
  const canFastForward = isFastForward(source, targetHeads, touched);
  if (input.strategy === "FAST_FORWARD" && !canFastForward) {
    return {
      mainHeadRevisionIds: targetHeads,
      sourceBranch: source,
      status: "FAST_FORWARD_REJECTED"
    };
  }

  const strategy = conflicts.length === 0 && canFastForward ? "FAST_FORWARD" : "SQUASH";
  const mergeRequest = mergeRequestFor(
    deps,
    input.userId,
    source,
    target.id,
    await severityByEntityFor(deps.revisionStore, touched),
    strategy,
    conflicts
  );
  await deps.mergeRequestStore.saveMergeRequest(mergeRequest);

  if (hardLock !== undefined) {
    return {
      holdingSession: hardLock.holder,
      mergeRequest,
      status: "HARD_LOCK",
      useCaseKey: await useCaseKey(deps.useCaseStore, hardLock.usecase_id)
    };
  }
  if (conflicts.length > 0) {
    return {
      mainHeadRevisionIds: targetHeads,
      mergeRequest,
      sourceBranch: source,
      status: "CONFLICTS"
    };
  }
  if (input.simulateWriteFailure) {
    return {
      exitCode: 5,
      mainHeadRevisionIds: targetHeads,
      mergeRequest,
      sourceBranch: source,
      status: "WRITE_FAILED"
    };
  }

  return cleanMerge(deps, source, target, targetHeads, touched, mergeRequest);
}

function mergeRequestFor(
  deps: MergeDeps,
  createdBy: string | undefined,
  source: StoredSpecBranch,
  targetBranchId: string,
  severityByEntity: Record<string, string>,
  strategy: "FAST_FORWARD" | "SQUASH",
  conflicts: Array<Record<string, unknown>>
): StoredMergeRequest {
  return {
    conflicts,
    created_by: createdBy,
    id: id(deps),
    current_revision_id: id(deps),
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: severityByEntity
    },
    source_branch_id: source.id,
    status: "OPEN",
    strategy,
    target_branch_id: targetBranchId
  };
}

async function cleanMerge(
  deps: MergeDeps,
  source: StoredSpecBranch,
  target: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[],
  mergeRequest: StoredMergeRequest
): Promise<Extract<OpenMergeResult, { status: "MERGED" }>> {
  target.head_revision_ids = {
    ...targetHeads,
    ...Object.fromEntries(
      touched.map((entityId) => [entityId, source.head_revision_ids?.[entityId] ?? ""])
    )
  };
  source.status = "MERGED";
  source.merged_at = now(deps).toISOString();
  await deps.branchStore.updateBranch(target);
  await deps.branchStore.updateBranch(source);
  mergeRequest.status = "MERGED";
  mergeRequest.resolved_at = now(deps).toISOString();
  await deps.mergeRequestStore.updateMergeRequest(mergeRequest);
  return {
    mainHeadRevisionIds: target.head_revision_ids,
    mergeRequest,
    sourceBranch: source,
    status: "MERGED"
  };
}

function isFastForward(
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  return touched.every(
    (entityId) => source.base_revision_ids?.[entityId] === targetHeads[entityId]
  );
}

async function mainHeadRevisions(
  deps: Pick<MergeDeps, "useCaseStore">,
  project: StoredProject,
  target: StoredSpecBranch
): Promise<Record<string, string>> {
  return {
    ...Object.fromEntries(
      (await deps.useCaseStore.listUseCases(project.id)).map((usecase) => [
        usecase.id,
        usecase.current_revision_id
      ])
    ),
    ...(target.head_revision_ids ?? {})
  };
}

function touchedEntityIds(
  source: StoredSpecBranch,
  targetHeads: Record<string, string>
) {
  return Object.entries(source.head_revision_ids ?? {})
    .filter(([entityId, revisionId]) => targetHeads[entityId] !== revisionId)
    .map(([entityId]) => entityId);
}

async function severityByEntityFor(
  revisionStore: RevisionStore,
  entityIds: string[]
): Promise<Record<string, string>> {
  const severities: Record<string, string> = {};
  for (const entityId of entityIds) {
    severities[entityId] =
      (await revisionStore.latestRevision(entityId))?.severity ?? "NON_BREAKING";
  }
  return severities;
}

function id(deps: MergeDeps): string {
  return (deps.idFactory ?? randomUUID)();
}

function now(deps: MergeDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
