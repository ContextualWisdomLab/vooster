import { randomUUID } from "node:crypto";
import type {
  UseCaseArchiveDeps,
  UseCaseArchiveInput,
  UseCaseArchiveResult,
  UseCaseRestoreResult
} from "./usecase-archive-types.js";
import type { StoredRevision, StoredUseCase } from "../http/signup-types.js";
export type {
  UseCaseArchiveInput,
  UseCaseArchiveResult,
  UseCaseRestoreResult
} from "./usecase-archive-types.js";

export async function archiveUseCase(
  deps: UseCaseArchiveDeps,
  input: UseCaseArchiveInput
): Promise<UseCaseArchiveResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (!(await canAccess(deps, found.projectId, input.userId))) {
    return { status: "FORBIDDEN" };
  }
  if (input.hardDeleteRequested) {
    return { status: "HARD_DELETE_REQUESTED", usecase: found.usecase };
  }
  if (found.usecase.archived_at !== null) {
    return { status: "ALREADY_ARCHIVED", usecase: found.usecase };
  }
  const hardLock = await activeHardLock(deps, found.usecase.id);
  if (hardLock !== undefined) {
    return {
      expiresAt: hardLock.expires_at,
      holdingSession: hardLock.held_by_session_id ?? hardLock.holder,
      lock: hardLock,
      status: "HARD_LOCKED"
    };
  }

  const archivedAt = now(deps);
  found.usecase.archived_at = archivedAt;
  const revision = await archiveRevision(deps, found.usecase);
  found.usecase.current_revision_id = revision.id;
  await deps.useCaseStore.updateUseCase(found.usecase);
  await deps.revisionStore.saveRevision(revision);
  await advanceMainHead(deps, found.usecase, revision.id);
  const affectedSessions = await affectedSessionsFor(deps, found.usecase.id);

  return {
    activeLocksCount: await activeLockCount(deps, found.usecase.id),
    affectedSessions,
    revision: { change_summary: revision.change_summary, id: revision.id },
    status: "ARCHIVED",
    usecase: { archived_at: archivedAt, id: found.usecase.id, key: found.usecase.key }
  };
}

export async function restoreUseCase(
  deps: UseCaseArchiveDeps,
  input: UseCaseArchiveInput
): Promise<UseCaseRestoreResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (!(await canAccess(deps, found.projectId, input.userId))) {
    return { status: "FORBIDDEN" };
  }
  if (found.usecase.archived_at === null) {
    return { status: "NOT_ARCHIVED" };
  }
  found.usecase.archived_at = null;
  const revision = await restoreRevision(deps, found.usecase);
  found.usecase.current_revision_id = revision.id;
  await deps.useCaseStore.updateUseCase(found.usecase);
  await deps.revisionStore.saveRevision(revision);
  await advanceMainHead(deps, found.usecase, revision.id);
  return {
    revision: { change_summary: revision.change_summary, id: revision.id },
    status: "RESTORED",
    usecase: { archived_at: null, id: found.usecase.id, key: found.usecase.key }
  };
}

async function canAccess(
  deps: Pick<UseCaseArchiveDeps, "membershipStore">,
  projectId: string,
  userId: string | undefined
) {
  return (
    userId !== undefined &&
    (await deps.membershipStore.membershipForProject(projectId, userId)) !== undefined
  );
}

async function archiveRevision(
  deps: Pick<UseCaseArchiveDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase
): Promise<StoredRevision> {
  return revisionFor(deps, usecase, `Archived use case ${usecase.key}`);
}

async function restoreRevision(
  deps: Pick<UseCaseArchiveDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase
): Promise<StoredRevision> {
  return revisionFor(deps, usecase, `Restored use case ${usecase.key}`);
}

async function revisionFor(
  deps: Pick<UseCaseArchiveDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase,
  changeSummary: string
): Promise<StoredRevision> {
  return {
    id: (deps.idFactory ?? randomUUID)(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase },
    change_summary: changeSummary
  };
}

async function advanceMainHead(
  deps: Pick<UseCaseArchiveDeps, "branchStore" | "projectStore">,
  usecase: StoredUseCase,
  revisionId: string
) {
  const project = await deps.projectStore.findProjectById(usecase.project_id);
  const main =
    project === undefined
      ? undefined
      : await deps.branchStore.findBranchById(project.default_branch_id);
  if (main !== undefined) {
    main.head_revision_ids = {
      ...(main.head_revision_ids ?? {}),
      [usecase.id]: revisionId
    };
    await deps.branchStore.updateBranch(main);
  }
}

async function activeLockCount(deps: UseCaseArchiveDeps, usecaseId: string) {
  return (await deps.lockStore.listLocksForUseCase(usecaseId)).filter(
    (lock) => Date.parse(lock.expires_at) > Date.parse(now(deps))
  ).length;
}

async function activeHardLock(deps: UseCaseArchiveDeps, usecaseId: string) {
  const lock = await deps.lockStore.findLockForUseCase(usecaseId);
  return lock?.mode === "HARD" && Date.parse(lock.expires_at) > Date.parse(now(deps))
    ? lock
    : undefined;
}

async function affectedSessionsFor(deps: UseCaseArchiveDeps, usecaseId: string) {
  return (await deps.workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .filter((session) => session.status === "ACTIVE")
    .map((session) => ({
      id: session.id,
      pinned_revision:
        session.pinned_revisions?.[usecaseId] ?? session.pinned_revision_id ?? ""
    }));
}

function now(deps: Pick<UseCaseArchiveDeps, "clock">) {
  return (deps.clock ?? (() => new Date().toISOString()))();
}
