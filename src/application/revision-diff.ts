import type { StoredRevision, StoredSpecBranch, StoredUseCase } from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
export type RevisionDiffFormat = "agent" | "human" | "json";
export type RevisionDiffChange = {
  change_type: "ADD" | "CHANGE";
  entity_type: "STEP" | "USECASE";
  path: string;
  revision: string;
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING";
  source_branch?: string;
};
export type RevisionDiffPayload = {
  changes: RevisionDiffChange[];
  cross_branch?: true;
  format: RevisionDiffFormat;
  from_revision: string;
  note?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  summary: { breaking: number; cosmetic: number; non_breaking: number };
  to_revision: string;
  usecase: { id: string; key: string };
  warnings?: Array<{ from_branch: string; to_branch: string; type: "CROSS_BRANCH_DIFF" }>;
};
export type CompareUseCaseRevisionsDeps = {
  branchStore: BranchStore;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};
export type CompareUseCaseRevisionsInput = {
  format: RevisionDiffFormat;
  fromRevisionId: string;
  toRevisionId: string;
  usecaseId: string;
  userId?: string;
};
export type CompareUseCaseRevisionsResult =
  | { status: "COMPARED"; diff: RevisionDiffPayload }
  | { status: "FORBIDDEN" }
  | { status: "MISSING_REVISION"; missingRevision: string; usecase: StoredUseCase }
  | { status: "USECASE_NOT_FOUND" };
export async function compareUseCaseRevisions(
  deps: CompareUseCaseRevisionsDeps,
  input: CompareUseCaseRevisionsInput
): Promise<CompareUseCaseRevisionsResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    await deps.membershipStore.membershipForProject(found.projectId, input.userId) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }

  const revisions = await deps.revisionStore.listRevisions(found.usecase.id);
  const from = revisionById(revisions, input.fromRevisionId);
  const to = revisionById(revisions, input.toRevisionId);
  if (from === undefined || to === undefined) {
    return {
      missingRevision: from === undefined ? input.fromRevisionId : input.toRevisionId,
      status: "MISSING_REVISION",
      usecase: found.usecase
    };
  }

  return {
    diff: await revisionDiff(
      deps.branchStore,
      found.projectId,
      found.usecase,
      revisions,
      from,
      to,
      input.format
    ),
    status: "COMPARED"
  };
}
async function revisionDiff(
  branchStore: BranchStore,
  projectId: string,
  usecase: StoredUseCase,
  revisions: StoredRevision[],
  from: StoredRevision,
  to: StoredRevision,
  format: RevisionDiffFormat
): Promise<RevisionDiffPayload> {
  const fromBranch = await branchForRevision(branchStore, projectId, from.id);
  const toBranch = await branchForRevision(branchStore, projectId, to.id);
  const changes = await Promise.all(
    revisionsBetween(revisions, from, to).map(async (revision) =>
      diffChange(revision, (await branchForRevision(branchStore, projectId, revision.id))?.name)
    )
  );

  return {
    changes,
    ...(fromBranch !== undefined && toBranch !== undefined && fromBranch.id !== toBranch.id
      ? crossBranchWarning(fromBranch, toBranch)
      : {}),
    format,
    from_revision: from.id,
    ...(from.id === to.id ? { note: "Revisions match byte-for-byte." } : {}),
    suggested_next_actions: nextActions(usecase, from.id),
    summary: summarize(changes),
    to_revision: to.id,
    usecase: { id: usecase.id, key: usecase.key }
  };
}
function revisionById(revisions: StoredRevision[], id: string): StoredRevision | undefined {
  return revisions.find((revision) => revision.id === id);
}
function revisionsBetween(revisions: StoredRevision[], from: StoredRevision, to: StoredRevision) {
  return revisions.filter(
    (revision) =>
      revision.version_number > from.version_number &&
      revision.version_number <= to.version_number
  );
}
function diffChange(revision: StoredRevision, sourceBranch?: string): RevisionDiffChange {
  const addedStep = /^Added step (?<stepNumber>\d+) to main success scenario$/.exec(
    revision.change_summary ?? ""
  );
  if (addedStep?.groups?.stepNumber !== undefined) {
    return {
      change_type: "ADD",
      entity_type: "STEP",
      path: `main_success.steps[${addedStep.groups.stepNumber}]`,
      revision: revision.id,
      severity: revision.severity ?? "NON_BREAKING",
      ...(sourceBranch === undefined ? {} : { source_branch: sourceBranch })
    };
  }

  return {
    change_type: "CHANGE",
    entity_type: "USECASE",
    path: "usecase.title",
    revision: revision.id,
    severity: revision.severity ?? "NON_BREAKING",
    ...(sourceBranch === undefined ? {} : { source_branch: sourceBranch })
  };
}
async function branchForRevision(
  branchStore: BranchStore,
  projectId: string,
  revisionId: string
): Promise<StoredSpecBranch | undefined> {
  return (await branchStore.listBranches(projectId)).find(
    (branch) =>
      branch.project_id === projectId &&
      Object.values(branch.head_revision_ids ?? {}).includes(revisionId)
  );
}
function crossBranchWarning(fromBranch: StoredSpecBranch, toBranch: StoredSpecBranch) {
  return {
    cross_branch: true as const,
    warnings: [
      {
        from_branch: fromBranch.name,
        to_branch: toBranch.name,
        type: "CROSS_BRANCH_DIFF" as const
      }
    ]
  };
}
function summarize(changes: RevisionDiffChange[]) {
  return {
    breaking: changes.filter((change) => change.severity === "BREAKING").length,
    cosmetic: changes.filter((change) => change.severity === "COSMETIC").length,
    non_breaking: changes.filter((change) => change.severity === "NON_BREAKING").length
  };
}
function nextActions(usecase: StoredUseCase, fromRevision: string) {
  return [
    {
      command: `vspec revert ${usecase.key} --to ${fromRevision}`,
      reason: "Restore the earlier revision if this change is not wanted."
    },
    {
      command: `vspec impact ${usecase.key}`,
      reason: "Check dependent work before approving the change."
    },
    {
      command: "vspec merge open",
      reason: "Open a merge request when the diff is acceptable."
    }
  ];
}
