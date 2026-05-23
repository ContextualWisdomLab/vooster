import Fastify from "fastify";
import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch
} from "../../../src/domain/entities/index.js";
import { registerProjectRoutes } from "../../../src/http/project-routes.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type {
  DeleteProjectOutcome,
  ProjectStore
} from "../../../src/ports/project-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

export type ProjectRouteOptions = {
  archived?: boolean;
  deleteOutcome?: DeleteProjectOutcome;
  duplicateProject?: StoredProject;
  member?: boolean;
  memberships?: StoredMembership[];
  project?: StoredProject | null;
  projectsByWorkspace?: Record<string, StoredProject[]>;
  savedBranches?: StoredSpecBranch[];
  savedProjects?: StoredProject[];
};

export function projectApp(options: ProjectRouteOptions = {}) {
  const app = Fastify();
  registerProjectRoutes(
    app,
    state(),
    undefined,
    branchStore(options.savedBranches ?? []),
    membershipStore(options),
    projectStore(options),
    workspaceStore(options)
  );
  return app;
}

export const authHeaders = () => ({ cookie: "vspec_session=session-1" });

export function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
  };
}

export function projectPayload(overrides: Record<string, unknown> = {}) {
  return {
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    ...overrides
  };
}

function state() {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set<string>(),
    sessionsByToken: new Map([["session-1", "user-1"]])
  };
}

function branchStore(savedBranches: StoredSpecBranch[]): BranchStore {
  return {
    findBranchById: () => Promise.resolve(undefined),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: (branch) => {
      savedBranches.push(branch);
      return Promise.resolve();
    },
    updateBranch: () => Promise.resolve()
  };
}

function membershipStore(options: ProjectRouteOptions): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () =>
      Promise.resolve(options.member === false ? undefined : membership()),
    membershipsForUser: () =>
      Promise.resolve(
        options.memberships ??
          (options.member === false
            ? []
            : [membership({ workspace_id: "workspace-1" })])
      ),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(options: ProjectRouteOptions): ProjectStore {
  const savedProjects = options.savedProjects ?? [];
  return {
    deleteProject: () => Promise.resolve(options.deleteOutcome ?? "DELETED"),
    findProjectById: () =>
      Promise.resolve(
        options.project === null ? undefined : (options.project ?? project())
      ),
    findProjectByWorkspaceAndKey: () => Promise.resolve(options.duplicateProject),
    listProjectsForWorkspace: (workspaceId) =>
      Promise.resolve(options.projectsByWorkspace?.[workspaceId] ?? []),
    saveProject: (createdProject) => {
      savedProjects.push(createdProject);
      return Promise.resolve();
    },
    updateProjectName: (projectId, name) =>
      Promise.resolve(project({ id: projectId, name }))
  };
}

function workspaceStore(options: ProjectRouteOptions): WorkspaceStore {
  return {
    archiveWorkspace: () => Promise.resolve(),
    findWorkspaceById: () => Promise.resolve(undefined),
    isWorkspaceArchived: () => Promise.resolve(options.archived === true),
    nextAvailableWorkspaceSlug: (slug) => Promise.resolve(slug),
    saveWorkspace: () => Promise.resolve(),
    workspaceSlugExists: () => Promise.resolve(false)
  };
}

function membership(overrides: Partial<StoredMembership> = {}): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}
