import { randomUUID } from "node:crypto";
import type {
  StoredRevision,
  StoredUseCase,
  StoredWorkSession
} from "../http/signup-types.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";
import type {
  RevisionRevertDeps,
  RevisionRevertInput,
  RevisionRevertResult
} from "./revision-revert-types.js";
export type {
  RevisionRevertDeps,
  RevisionRevertInput,
  RevisionRevertResult
} from "./revision-revert-types.js";

export async function revertUseCaseRevision(
  deps: RevisionRevertDeps,
  input: RevisionRevertInput,
  idFactory: () => string = randomUUID
): Promise<RevisionRevertResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }

  const lock = await deps.lockStore.findLockForUseCase(found.usecase.id);
  if (lock?.mode === "HARD") {
    return { lock, status: "HARD_LOCKED", usecase: found.usecase };
  }

  const revisions = await deps.revisionStore.listRevisions(found.usecase.id);
  const target = revisions.find((revision) => revision.id === input.revisionId);
  if (target === undefined) {
    return {
      revisionId: input.revisionId,
      status: "TARGET_REVISION_NOT_FOUND",
      usecase: found.usecase
    };
  }
  const current = revisions.at(-1);
  if (current === undefined) {
    return { status: "CURRENT_REVISION_NOT_FOUND" };
  }
  if (!input.force && current.severity === "BREAKING") {
    return {
      affectedSessions: await activeSessionIds(deps.workSessionStore, found.usecase.id),
      currentRevision: current,
      status: "BREAKING_REVERT",
      targetRevisionId: target.id,
      usecase: found.usecase
    };
  }
  if (input.simulateWriteFailure) {
    return {
      status: "WRITE_FAILED",
      targetRevisionId: target.id,
      usecase: found.usecase
    };
  }

  const revision = revertRevision(
    found.usecase,
    target,
    current,
    revisions.length + 1,
    idFactory
  );
  Object.assign(found.usecase, target.snapshot, { current_revision_id: revision.id });
  await deps.useCaseStore.updateUseCase(found.usecase);
  await deps.revisionStore.saveRevision(revision);
  await advanceMainHead(deps, found.projectId, found.usecase.id, revision.id);

  return {
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity: revision.severity
    },
    revision,
    status: "REVERTED",
    suggestedNextActions: nextActions(found.usecase.key),
    usecase: found.usecase,
    ...(input.simulateGherkinDrift ? { warnings: [gherkinDriftWarning()] } : {})
  };
}

function revertRevision(
  usecase: StoredUseCase,
  target: StoredRevision,
  current: StoredRevision,
  versionNumber: number,
  idFactory: () => string
): StoredRevision {
  return {
    change_summary: `Revert to ${target.id}`,
    entity_id: usecase.id,
    entity_type: "USECASE",
    id: idFactory(),
    parent_revision_id: current.id,
    severity: current.severity ?? "NON_BREAKING",
    snapshot: target.snapshot,
    version_number: versionNumber
  };
}

async function advanceMainHead(
  deps: Pick<RevisionRevertDeps, "branchStore" | "projectStore">,
  projectId: string,
  usecaseId: string,
  revisionId: string
) {
  const project = await deps.projectStore.findProjectById(projectId);
  const branch =
    project === undefined
      ? undefined
      : await deps.branchStore.findBranchById(project.default_branch_id);
  if (branch !== undefined) {
    branch.head_revision_ids = {
      ...(branch.head_revision_ids ?? {}),
      [usecaseId]: revisionId
    };
    await deps.branchStore.updateBranch(branch);
  }
}

async function activeSessionIds(workSessionStore: WorkSessionStore, usecaseId: string) {
  return (await workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .filter(isActiveSession)
    .map((session) => session.id);
}

function isActiveSession(session: StoredWorkSession) {
  return session.status === "ACTIVE";
}

function gherkinDriftWarning() {
  return {
    message: "Pinned CI feature files will drift on next sync.",
    type: "GHERKIN_DRIFT"
  };
}

function nextActions(key: string) {
  return [
    {
      command: `vspec history ${key}`,
      reason: "Review the append-only revision history."
    },
    {
      command: "vspec session list --status=active",
      reason: "Check sessions affected by the revert."
    }
  ];
}
