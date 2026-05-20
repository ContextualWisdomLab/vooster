import { randomUUID } from "node:crypto";
import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch
} from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type CreateBranchInput = {
  from: string;
  name: string;
  projectId: string;
  simulateSnapshotFailure: boolean;
  userId: string | undefined;
};

type CreateBranchDeps = {
  branchStore: BranchStore;
  idFactory?: () => string;
  isReadOnlyMembership: (membership: StoredMembership) => boolean;
  membershipStore: MembershipStore;
  mergeRequestStore: MergeRequestStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type CreateBranchResult =
  | { status: "ACCESS_DENIED" }
  | { status: "READ_ONLY" }
  | { branchName: string; status: "NON_MAIN_BASE" }
  | { status: "NAME_COLLISION"; suggestedName: string }
  | { status: "PROJECT_BRANCH_NOT_FOUND" }
  | { branchName: string; exitCode: 5; status: "SNAPSHOT_FAILED" }
  | {
      branch: StoredSpecBranch;
      status: "CREATED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
      warnings: Array<{ merge_request_id: string; type: "IN_FLIGHT_MERGE_REQUEST" }>;
    };

export async function createBranch(
  deps: CreateBranchDeps,
  input: CreateBranchInput
): Promise<CreateBranchResult> {
  const membership =
    input.userId === undefined
      ? undefined
      : await deps.membershipStore.membershipForProject(input.projectId, input.userId);
  if (membership === undefined) {
    return { status: "ACCESS_DENIED" };
  }
  if (deps.isReadOnlyMembership(membership)) {
    return { status: "READ_ONLY" };
  }
  if (input.from !== "main") {
    return { branchName: input.name, status: "NON_MAIN_BASE" };
  }
  if (await branchNameExists(deps.branchStore, input.projectId, input.name)) {
    return {
      status: "NAME_COLLISION",
      suggestedName: await nextBranchName(deps.branchStore, input.projectId, input.name)
    };
  }

  const project = await deps.projectStore.findProjectById(input.projectId);
  const baseBranch =
    project === undefined
      ? undefined
      : await deps.branchStore.findBranchById(project.default_branch_id);
  if (project === undefined || baseBranch === undefined) {
    return { status: "PROJECT_BRANCH_NOT_FOUND" };
  }
  if (input.simulateSnapshotFailure) {
    return { branchName: input.name, exitCode: 5, status: "SNAPSHOT_FAILED" };
  }

  const snapshot = await mainHeadSnapshot(
    deps.revisionStore,
    project,
    deps.useCaseStore
  );
  const branch: StoredSpecBranch = {
    id: (deps.idFactory ?? randomUUID)(),
    project_id: input.projectId,
    name: input.name,
    owner_type: "HUMAN",
    owner_id: membership.user_id,
    base_branch_id: baseBranch.id,
    base_revision_ids: snapshot,
    head_revision_ids: snapshot,
    status: "ACTIVE"
  };
  await deps.branchStore.saveBranch(branch);

  return {
    branch,
    status: "CREATED",
    suggestedNextActions: [
      {
        command: `vspec branch checkout ${branch.name}`,
        reason: "Switch to the isolated branch."
      },
      {
        command: `vspec usecase edit ${await firstUseCaseKey(input.projectId, deps.useCaseStore)}`,
        reason: "Start editing a use case on the branch."
      }
    ],
    warnings: await inFlightMergeRequestWarnings(deps.mergeRequestStore, baseBranch.id)
  };
}

async function inFlightMergeRequestWarnings(
  mergeRequestStore: MergeRequestStore,
  targetBranchId: string
) {
  return (
    await mergeRequestStore.listOpenMergeRequestsByTargetBranchId(targetBranchId)
  ).map((mergeRequest) => ({
    merge_request_id: mergeRequest.id,
    type: "IN_FLIGHT_MERGE_REQUEST" as const
  }));
}

async function mainHeadSnapshot(
  revisionStore: RevisionStore,
  project: StoredProject,
  useCaseStore: UseCaseStore
): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const usecase of await useCaseStore.listUseCases(project.id)) {
    snapshot[usecase.id] =
      (await revisionStore.latestRevision(usecase.id))?.id ??
      usecase.current_revision_id;
  }
  return snapshot;
}

async function firstUseCaseKey(projectId: string, useCaseStore: UseCaseStore) {
  return (await useCaseStore.listUseCases(projectId))[0]?.key ?? "<KEY>";
}

async function branchNameExists(
  branchStore: BranchStore,
  projectId: string,
  name: string
): Promise<boolean> {
  return (await branchStore.findBranchByProjectAndName(projectId, name)) !== undefined;
}

async function nextBranchName(
  branchStore: BranchStore,
  projectId: string,
  name: string
): Promise<string> {
  let suffix = 2;
  let candidate = `${name}-${String(suffix)}`;
  while (await branchNameExists(branchStore, projectId, candidate)) {
    suffix += 1;
    candidate = `${name}-${String(suffix)}`;
  }
  return candidate;
}
