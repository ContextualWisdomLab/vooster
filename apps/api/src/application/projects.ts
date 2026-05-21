import { randomUUID } from "node:crypto";
import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch
} from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { SignupStore } from "../ports/signup-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export type ProjectCreationDeps = {
  branchStore: BranchStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  signupStore?: Pick<SignupStore, "saveProjectWithDefaultBranch">;
  workspaceStore: WorkspaceStore;
};

export type ProjectCreationInput = {
  key: string;
  name: string;
  simulateBranchInsertFailure: boolean;
  userId: string | undefined;
  visibility: StoredProject["visibility"];
  workspaceId: string;
};

export type ProjectCreationResult =
  | { defaultBranch: StoredSpecBranch; project: StoredProject; status: "CREATED" }
  | { status: "FORBIDDEN" }
  | { status: "WORKSPACE_ARCHIVED" }
  | { existingProject: StoredProject; status: "DUPLICATE_KEY" }
  | { requestId: string; status: "CREATE_FAILED" };

export async function createProject(
  deps: ProjectCreationDeps,
  input: ProjectCreationInput
): Promise<ProjectCreationResult> {
  const membership = await membershipFor(deps.membershipStore, input.userId, input.workspaceId);
  if (membership === undefined) {
    return { status: "FORBIDDEN" };
  }
  if (await deps.workspaceStore.isWorkspaceArchived(input.workspaceId)) {
    return { status: "WORKSPACE_ARCHIVED" };
  }

  const existing = await deps.projectStore.findProjectByWorkspaceAndKey(
    input.workspaceId,
    input.key
  );
  if (existing !== undefined) {
    return { existingProject: existing, status: "DUPLICATE_KEY" };
  }
  if (input.simulateBranchInsertFailure) {
    return { requestId: id(deps), status: "CREATE_FAILED" };
  }

  const project = newProject(deps, input);
  const defaultBranch = mainBranch(deps, project, membership);
  project.default_branch_id = defaultBranch.id;

  if (deps.signupStore === undefined) {
    await deps.projectStore.saveProject(project);
    await deps.branchStore.saveBranch(defaultBranch);
  } else {
    await deps.signupStore.saveProjectWithDefaultBranch(project, defaultBranch);
  }

  return { defaultBranch, project, status: "CREATED" };
}

function membershipFor(
  membershipStore: MembershipStore,
  userId: string | undefined,
  workspaceId: string
): Promise<StoredMembership | undefined> {
  if (userId === undefined) {
    return Promise.resolve(undefined);
  }

  return membershipStore.membershipForWorkspace(workspaceId, userId);
}

function newProject(deps: ProjectCreationDeps, input: ProjectCreationInput): StoredProject {
  return {
    default_branch_id: "",
    id: id(deps),
    key: input.key,
    name: input.name,
    visibility: input.visibility,
    workspace_id: input.workspaceId
  };
}

function mainBranch(
  deps: ProjectCreationDeps,
  project: StoredProject,
  membership: StoredMembership
): StoredSpecBranch {
  return {
    base_branch_id: null,
    id: id(deps),
    name: "main",
    owner_id: membership.user_id,
    owner_type: "HUMAN",
    project_id: project.id
  };
}

function id(deps: ProjectCreationDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
