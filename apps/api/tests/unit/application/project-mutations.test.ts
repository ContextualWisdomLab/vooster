import { describe, expect, test } from "vitest";
import {
  createProject,
  createProjectInDefaultWorkspace,
  deleteProject,
  renameProject
} from "../../../src/application/projects.js";
import type {
  StoredMembership,
  StoredProject
} from "../../../src/domain/entities/index.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type {
  DeleteProjectOutcome,
  ProjectStore
} from "../../../src/ports/project-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

describe("project application mutations", () => {
  test("rejects project creation when no user or default workspace is available", async () => {
    await expect(
      createProject(creationDeps(), {
        key: "PAY",
        name: "Payments",
        simulateBranchInsertFailure: false,
        userId: undefined,
        visibility: "PRIVATE",
        workspaceId: "workspace-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });

    await expect(
      createProjectInDefaultWorkspace(mutationDeps({ memberships: [] }), {
        key: "PAY",
        name: "Payments",
        simulateBranchInsertFailure: false,
        userId: "user-1",
        visibility: "PRIVATE"
      })
    ).resolves.toEqual({ status: "NO_WORKSPACE" });

    await expect(
      createProjectInDefaultWorkspace(mutationDeps(), {
        key: "PAY",
        name: "Payments",
        simulateBranchInsertFailure: false,
        userId: undefined,
        visibility: "PRIVATE"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });

  test("reports rename project edge cases", async () => {
    await expect(
      renameProject(mutationDeps({ project: undefined }), renameInput())
    ).resolves.toEqual({ status: "NOT_FOUND" });
    await expect(
      renameProject(mutationDeps({ membership: undefined }), renameInput())
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      renameProject(mutationDeps({ archived: true }), renameInput())
    ).resolves.toEqual({ status: "WORKSPACE_ARCHIVED" });
    await expect(
      renameProject(mutationDeps({ updatedProject: undefined }), renameInput())
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });

  test("reports delete project edge cases", async () => {
    await expect(
      deleteProject(mutationDeps({ project: undefined }), deleteInput())
    ).resolves.toEqual({ status: "NOT_FOUND" });
    await expect(
      deleteProject(mutationDeps({ membership: undefined }), deleteInput())
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      deleteProject(mutationDeps({ archived: true }), deleteInput())
    ).resolves.toEqual({ status: "WORKSPACE_ARCHIVED" });
    await expect(
      deleteProject(mutationDeps({ deleteOutcome: "HAS_DEPENDENCIES" }), deleteInput())
    ).resolves.toEqual({ status: "HAS_DEPENDENCIES" });
    await expect(
      deleteProject(mutationDeps({ deleteOutcome: "NOT_FOUND" }), deleteInput())
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });
});

type MutationOptions = {
  archived?: boolean;
  deleteOutcome?: DeleteProjectOutcome;
  membership?: StoredMembership;
  memberships?: StoredMembership[];
  project?: StoredProject;
  updatedProject?: StoredProject;
};

function creationDeps() {
  return {
    branchStore: branchStore(),
    membershipStore: membershipStore({ membership: undefined }),
    projectStore: projectStore({}),
    workspaceStore: workspaceStore({})
  };
}

function mutationDeps(options: MutationOptions = {}) {
  return {
    branchStore: branchStore(),
    membershipStore: membershipStore(options),
    projectStore: projectStore(options),
    workspaceStore: workspaceStore(options)
  };
}

function branchStore(): BranchStore {
  return {
    findBranchById: () => Promise.resolve(undefined),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: () => Promise.resolve(),
    updateBranch: () => Promise.resolve()
  };
}

function membershipStore(options: MutationOptions): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () =>
      Promise.resolve("membership" in options ? options.membership : membership()),
    membershipsForUser: () => Promise.resolve(options.memberships ?? [membership()]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(options: MutationOptions): ProjectStore {
  return {
    deleteProject: () => Promise.resolve(options.deleteOutcome ?? "DELETED"),
    findProjectById: () =>
      Promise.resolve("project" in options ? options.project : project()),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve(),
    updateProjectName: () =>
      Promise.resolve(
        "updatedProject" in options
          ? options.updatedProject
          : project({ name: "Billing" })
      )
  };
}

function workspaceStore(options: MutationOptions): WorkspaceStore {
  return {
    archiveWorkspace: () => Promise.resolve(),
    findWorkspaceById: () => Promise.resolve(undefined),
    isWorkspaceArchived: () => Promise.resolve(options.archived === true),
    nextAvailableWorkspaceSlug: (slug) => Promise.resolve(slug),
    saveWorkspace: () => Promise.resolve(),
    workspaceSlugExists: () => Promise.resolve(false)
  };
}

function renameInput() {
  return { name: "Billing", projectId: "project-1", userId: "user-1" };
}

function deleteInput() {
  return { projectId: "project-1", userId: "user-1" };
}

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-1",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
