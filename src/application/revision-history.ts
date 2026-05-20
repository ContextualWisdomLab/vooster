import type { StoredRevision, StoredUseCase } from "../domain/entities/index.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type RevisionHistoryDeps = {
  membershipStore: MembershipStore;
  now?: () => Date;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type RevisionHistoryInput = {
  limit: number;
  projectId: string | undefined;
  simulateReadFailure: boolean;
  usecaseId: string;
  userId: string | undefined;
};

export type RevisionHistoryRow = {
  author: string;
  change_summary: string | undefined;
  entity_id: string;
  entity_type: StoredRevision["entity_type"];
  revision: string;
  timestamp: string;
  version_number: number;
};

export type RevisionHistoryPayload = {
  limit: number;
  revisions: RevisionHistoryRow[];
  suggested_next_actions: Array<{ command: string; reason: string }>;
  suppressed_count: number;
  truncated: boolean;
  usecase: { id: string; key: string };
};

export type RevisionHistoryResult =
  | { history: RevisionHistoryPayload; status: "LISTED" }
  | { projectKey: string; status: "USECASE_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | { status: "READ_FAILED"; usecase: StoredUseCase };

export async function listRevisionHistory(
  deps: RevisionHistoryDeps,
  input: RevisionHistoryInput
): Promise<RevisionHistoryResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return {
      projectKey: await projectKeyFor(deps.projectStore, input.projectId),
      status: "USECASE_NOT_FOUND"
    };
  }
  if (
    input.userId === undefined ||
    await deps.membershipStore.membershipForProject(found.projectId, input.userId) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }
  if (input.simulateReadFailure) {
    return { status: "READ_FAILED", usecase: found.usecase };
  }

  const userId = input.userId;
  const allRows = (await deps.revisionStore.listRevisions(found.usecase.id))
    .sort((left, right) => right.version_number - left.version_number)
    .map((revision) => revisionRow(deps, revision, userId));
  const revisions = allRows.slice(0, input.limit);
  const suppressedCount = allRows.length - revisions.length;
  return {
    history: {
      limit: input.limit,
      revisions,
      suggested_next_actions: nextActions(found.usecase, revisions, suppressedCount),
      suppressed_count: suppressedCount,
      truncated: allRows.length > revisions.length,
      usecase: { id: found.usecase.id, key: found.usecase.key }
    },
    status: "LISTED"
  };
}

async function projectKeyFor(
  projectStore: ProjectStore,
  projectId: string | undefined
): Promise<string> {
  if (projectId === undefined) {
    return "unknown";
  }

  return (await projectStore.findProjectById(projectId))?.key ?? "unknown";
}

function revisionRow(
  deps: RevisionHistoryDeps,
  revision: StoredRevision,
  userId: string
): RevisionHistoryRow {
  return {
    author: userId,
    change_summary: revision.change_summary,
    entity_id: revision.entity_id,
    entity_type: revision.entity_type,
    revision: revision.id,
    timestamp: now(deps).toISOString(),
    version_number: revision.version_number
  };
}

function nextActions(
  usecase: StoredUseCase,
  revisions: RevisionHistoryRow[],
  suppressedCount: number
) {
  const latestRevision = revisions[0]?.revision ?? usecase.current_revision_id;
  return [
    {
      command: `vspec usecase show ${usecase.key} --revision=${latestRevision}`,
      reason: "Inspect the selected revision."
    },
    {
      command: "vspec diff",
      reason: "Compare two revisions before reverting."
    },
    ...(
      suppressedCount === 0
        ? []
        : [{
            command: `vspec history ${usecase.key} --limit ${String(revisions.length + suppressedCount)}`,
            reason: "Rerun with a larger limit to include suppressed rows."
          }]
    )
  ];
}

function now(deps: RevisionHistoryDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
