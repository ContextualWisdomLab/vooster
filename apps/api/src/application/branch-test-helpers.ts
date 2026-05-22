import { randomUUID } from "node:crypto";
import type { BranchStore } from "../ports/branch-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { StoredRevision, StoredUseCase } from "../domain/entities/index.js";

type BranchTestDeps = {
  branchStore: BranchStore;
  idFactory?: () => string;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

type RevisionSeverity = "BREAKING" | "COSMETIC" | "NON_BREAKING";
type AdvanceResult =
  | { revisionId: string; status: "ADVANCED" }
  | { status: "NOT_FOUND" };

type UseCaseInput = {
  severity: RevisionSeverity;
  title: string;
  usecaseId: string;
};

type ExtensionInput = {
  condition: string;
  extensionPoint: string;
  usecaseId: string;
};

export async function advanceBranchUseCaseRevision(
  deps: BranchTestDeps,
  input: UseCaseInput & { branchId: string }
): Promise<AdvanceResult> {
  const target = await branchTarget(deps, input.branchId, input.usecaseId);
  if (target === undefined) {
    return { status: "NOT_FOUND" };
  }
  const revision = await useCaseRevision(deps, target.usecase, input, input.branchId);
  target.branch.head_revision_ids = nextBranchHeads(
    target.branch,
    target.usecase.id,
    revision.id
  );
  await deps.revisionStore.saveRevision(revision);
  await deps.branchStore.updateBranch(target.branch);
  await deps.useCaseStore.updateUseCase(target.usecase);
  return { revisionId: revision.id, status: "ADVANCED" };
}

export async function advanceBranchExtensionRevision(
  deps: BranchTestDeps,
  input: ExtensionInput & { branchId: string }
): Promise<AdvanceResult> {
  const target = await branchTarget(deps, input.branchId, input.usecaseId);
  if (target === undefined) {
    return { status: "NOT_FOUND" };
  }
  const revision = await extensionRevision(deps, target.usecase, input, input.branchId);
  target.branch.head_revision_ids = nextBranchHeads(
    target.branch,
    target.usecase.id,
    revision.id
  );
  await deps.revisionStore.saveRevision(revision);
  await deps.branchStore.updateBranch(target.branch);
  await deps.useCaseStore.updateUseCase(target.usecase);
  return { revisionId: revision.id, status: "ADVANCED" };
}

export async function advanceMainUseCaseRevision(
  deps: BranchTestDeps,
  input: UseCaseInput
): Promise<AdvanceResult> {
  const usecase = await usecaseFor(deps, input.usecaseId);
  if (usecase === undefined) {
    return { status: "NOT_FOUND" };
  }
  const revision = await useCaseRevision(deps, usecase, input);
  usecase.title = input.title;
  usecase.current_revision_id = revision.id;
  await deps.useCaseStore.updateUseCase(usecase);
  await deps.revisionStore.saveRevision(revision);
  await advanceMainHead(deps, usecase, revision.id);
  return { revisionId: revision.id, status: "ADVANCED" };
}

export async function advanceMainExtensionRevision(
  deps: BranchTestDeps,
  input: ExtensionInput
): Promise<AdvanceResult> {
  const usecase = await usecaseFor(deps, input.usecaseId);
  if (usecase === undefined) {
    return { status: "NOT_FOUND" };
  }
  const revision = await extensionRevision(deps, usecase, input);
  usecase.current_revision_id = revision.id;
  await deps.useCaseStore.updateUseCase(usecase);
  await deps.revisionStore.saveRevision(revision);
  await advanceMainHead(deps, usecase, revision.id);
  return { revisionId: revision.id, status: "ADVANCED" };
}

async function branchTarget(deps: BranchTestDeps, branchId: string, usecaseId: string) {
  const branch = await deps.branchStore.findBranchById(branchId);
  const usecase = await usecaseFor(deps, usecaseId);
  if (branch === undefined || usecase === undefined) {
    return undefined;
  }
  return { branch, usecase };
}

async function usecaseFor(deps: BranchTestDeps, usecaseId: string) {
  return (await deps.useCaseStore.findUseCaseWithProject(usecaseId))?.usecase;
}

function nextBranchHeads(
  branch: {
    base_revision_ids?: Record<string, string>;
    head_revision_ids?: Record<string, string>;
  },
  usecaseId: string,
  revisionId: string
) {
  return {
    ...(branch.head_revision_ids ?? branch.base_revision_ids ?? {}),
    [usecaseId]: revisionId
  };
}

async function advanceMainHead(
  deps: BranchTestDeps,
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

async function useCaseRevision(
  deps: BranchTestDeps,
  usecase: StoredUseCase,
  data: { severity: RevisionSeverity; title: string },
  branchId?: string
): Promise<StoredRevision> {
  return {
    ...(branchId === undefined ? {} : { branch_id: branchId }),
    entity_id: usecase.id,
    entity_type: "USECASE",
    id: (deps.idFactory ?? randomUUID)(),
    severity: data.severity,
    snapshot: { ...usecase, title: data.title },
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id)
  };
}

async function extensionRevision(
  deps: BranchTestDeps,
  usecase: StoredUseCase,
  data: ExtensionInput,
  branchId?: string
): Promise<StoredRevision> {
  return {
    ...(branchId === undefined ? {} : { branch_id: branchId }),
    change_summary: `extension:${data.extensionPoint}:${data.condition}`,
    entity_id: usecase.id,
    entity_type: "USECASE",
    id: (deps.idFactory ?? randomUUID)(),
    severity: "NON_BREAKING",
    snapshot: { ...usecase },
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id)
  };
}
