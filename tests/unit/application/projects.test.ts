import { describe, expect, test } from "vitest";
import { createProject } from "../../../src/application/projects.js";
import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch
} from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { SignupStore } from "../../../src/ports/signup-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

describe("projects application", () => {
  test("creates a project with a default main branch through the transaction store", async () => {
    const savedTransactions: Array<{ project: StoredProject; branch: StoredSpecBranch }> = [];
    const separateProjectSaves: StoredProject[] = [];
    const separateBranchSaves: StoredSpecBranch[] = [];

    const result = await createProject(
      depsFor({ savedTransactions, separateBranchSaves, separateProjectSaves }),
      {
        key: "PAY",
        name: "Payments",
        simulateBranchInsertFailure: false,
        userId: "user-1",
        visibility: "INTERNAL",
        workspaceId: "workspace-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected project to be created");
    }
    expect(result.project).toEqual({
      default_branch_id: "id-2",
      id: "id-1",
      key: "PAY",
      name: "Payments",
      visibility: "INTERNAL",
      workspace_id: "workspace-1"
    });
    expect(result.defaultBranch).toEqual({
      base_branch_id: null,
      id: "id-2",
      name: "main",
      owner_id: "user-1",
      owner_type: "HUMAN",
      project_id: "id-1"
    });
    expect(savedTransactions).toEqual([
      { branch: result.defaultBranch, project: result.project }
    ]);
    expect(separateProjectSaves).toEqual([]);
    expect(separateBranchSaves).toEqual([]);
  });

  test("falls back to separate project and branch stores", async () => {
    const separateProjectSaves: StoredProject[] = [];
    const separateBranchSaves: StoredSpecBranch[] = [];

    const result = await createProject(
      depsFor({
        separateBranchSaves,
        separateProjectSaves,
        signupStore: undefined
      }),
      projectInput()
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected project to be created");
    }
    expect(separateProjectSaves).toEqual([result.project]);
    expect(separateBranchSaves).toEqual([result.defaultBranch]);
  });

  test("rejects unauthorized, archived, duplicate, and simulated failures without writes", async () => {
    const existing = project({ id: "project-existing" });
    const savedTransactions: Array<{ project: StoredProject; branch: StoredSpecBranch }> = [];

    await expect(
      createProject(depsFor({ membership: null, savedTransactions }), projectInput())
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      createProject(depsFor({ archived: true, savedTransactions }), projectInput())
    ).resolves.toEqual({ status: "WORKSPACE_ARCHIVED" });
    await expect(
      createProject(depsFor({ existingProject: existing, savedTransactions }), projectInput())
    ).resolves.toEqual({ existingProject: existing, status: "DUPLICATE_KEY" });
    await expect(
      createProject(
        depsFor({ savedTransactions }),
        projectInput({ simulateBranchInsertFailure: true })
      )
    ).resolves.toEqual({ requestId: "id-1", status: "CREATE_FAILED" });

    expect(savedTransactions).toEqual([]);
  });
});

function depsFor(
  options: {
    archived?: boolean;
    existingProject?: StoredProject;
    membership?: StoredMembership | null;
    savedTransactions?: Array<{ project: StoredProject; branch: StoredSpecBranch }>;
    separateBranchSaves?: StoredSpecBranch[];
    separateProjectSaves?: StoredProject[];
    signupStore?: Pick<SignupStore, "saveProjectWithDefaultBranch"> | undefined;
  } = {}
) {
  const savedTransactions = options.savedTransactions ?? [];
  return {
    branchStore: branchStore(options.separateBranchSaves ?? []),
    idFactory: idFactory(),
    membershipStore: membershipStore(
      "membership" in options ? options.membership ?? null : membership()
    ),
    projectStore: projectStore(options.existingProject, options.separateProjectSaves ?? []),
    signupStore: "signupStore" in options
      ? options.signupStore
      : signupStore(savedTransactions),
    workspaceStore: workspaceStore(options.archived ?? false)
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

function membershipStore(value: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () => Promise.resolve(value ?? undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(
  existing: StoredProject | undefined,
  savedProjects: StoredProject[]
): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(existing),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: (project) => {
      savedProjects.push(project);
      return Promise.resolve();
    }
  };
}

function signupStore(
  savedTransactions: Array<{ project: StoredProject; branch: StoredSpecBranch }>
): Pick<SignupStore, "saveProjectWithDefaultBranch"> {
  return {
    saveProjectWithDefaultBranch: (project, branch) => {
      savedTransactions.push({ branch, project });
      return Promise.resolve();
    }
  };
}

function workspaceStore(archived: boolean): WorkspaceStore {
  return {
    archiveWorkspace: () => Promise.resolve(),
    findWorkspaceById: () => Promise.resolve(undefined),
    isWorkspaceArchived: () => Promise.resolve(archived),
    nextAvailableWorkspaceSlug: (slug) => Promise.resolve(slug),
    saveWorkspace: () => Promise.resolve(),
    workspaceSlugExists: () => Promise.resolve(false)
  };
}

function projectInput(overrides: Partial<Parameters<typeof createProject>[1]> = {}) {
  return {
    key: "PAY",
    name: "Payments",
    simulateBranchInsertFailure: false,
    userId: "user-1",
    visibility: "PRIVATE" as const,
    workspaceId: "workspace-1",
    ...overrides
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
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
