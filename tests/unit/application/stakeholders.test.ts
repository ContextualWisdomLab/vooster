import { describe, expect, test } from "vitest";
import { createStakeholder } from "../../../src/application/stakeholders.js";
import type {
  StoredProject,
  StoredRevision,
  StoredStakeholder
} from "../../../src/http/signup-types.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

describe("stakeholders application", () => {
  test("creates a stakeholder with an initial revision", async () => {
    const savedStakeholders: StoredStakeholder[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await createStakeholder(
      depsFor({ savedRevisions, savedStakeholders }),
      createInput()
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected stakeholder creation");
    }
    expect(result.stakeholder).toEqual({
      archived_at: null,
      description: "Owns checkout outcomes.",
      id: "id-1",
      name: "Product Manager",
      project_id: "project-1",
      type: "INTERNAL"
    });
    expect(result.revision).toEqual({
      entity_id: "id-1",
      entity_type: "STAKEHOLDER",
      id: "id-2",
      snapshot: result.stakeholder,
      version_number: 1
    });
    expect(savedStakeholders).toEqual([result.stakeholder]);
    expect(savedRevisions).toEqual([result.revision]);
  });

  test("rejects invalid and duplicate stakeholder requests without writing", async () => {
    const savedStakeholders: StoredStakeholder[] = [];
    const savedRevisions: StoredRevision[] = [];
    const existing = stakeholder({ id: "stakeholder-existing", name: "Product Manager" });

    await expect(
      createStakeholder(
        depsFor({ savedRevisions, savedStakeholders }),
        createInput({ attachToStep: true })
      )
    ).resolves.toEqual({ status: "ACTOR_REQUIRED_FOR_STEPS" });
    await expect(
      createStakeholder(
        depsFor({ savedRevisions, savedStakeholders }),
        createInput({ type: "LEGAL" })
      )
    ).resolves.toEqual({
      status: "INVALID_TYPE",
      validTypes: ["INTERNAL", "EXTERNAL", "REGULATORY"]
    });
    await expect(
      createStakeholder(
        depsFor({ existingStakeholder: existing, savedRevisions, savedStakeholders }),
        createInput()
      )
    ).resolves.toEqual({
      existingStakeholder: existing,
      status: "DUPLICATE_NAME"
    });

    expect(savedStakeholders).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("rejects archived project workspaces without writing", async () => {
    const savedStakeholders: StoredStakeholder[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await createStakeholder(
      depsFor({ archivedWorkspace: true, savedRevisions, savedStakeholders }),
      createInput({ name: "Auditor", type: "REGULATORY" })
    );

    expect(result).toEqual({ status: "WORKSPACE_ARCHIVED" });
    expect(savedStakeholders).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });
});

function depsFor(
  options: {
    archivedWorkspace?: boolean;
    existingStakeholder?: StoredStakeholder;
    project?: StoredProject;
    savedRevisions?: StoredRevision[];
    savedStakeholders?: StoredStakeholder[];
  } = {}
) {
  const savedRevisions = options.savedRevisions ?? [];
  const savedStakeholders = options.savedStakeholders ?? [];

  return {
    idFactory: idFactory(),
    projectStore: projectStore(options.project ?? project()),
    revisionStore: revisionStore(savedRevisions),
    stakeholderStore: stakeholderStore(options.existingStakeholder, savedStakeholders),
    workspaceStore: workspaceStore(options.archivedWorkspace === true)
  };
}

function projectStore(value: StoredProject): ProjectStore {
  return {
    findProjectById: (projectId) =>
      Promise.resolve(projectId === value.id ? value : undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function stakeholderStore(
  existingStakeholder: StoredStakeholder | undefined,
  savedStakeholders: StoredStakeholder[]
): StakeholderStore {
  return {
    findStakeholderById: () => Promise.resolve(undefined),
    findStakeholderByName: (_projectId, name) =>
      Promise.resolve(existingStakeholder?.name === name ? existingStakeholder : undefined),
    listStakeholders: () => Promise.resolve([]),
    saveStakeholder: (stakeholder) => {
      savedStakeholders.push(stakeholder);
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

function createInput(overrides: Partial<Parameters<typeof createStakeholder>[1]> = {}) {
  return {
    attachToStep: false,
    description: "Owns checkout outcomes.",
    name: "Product Manager",
    projectId: "project-1",
    type: "INTERNAL",
    ...overrides
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
}

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "CHK",
    name: "Checkout",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function stakeholder(overrides: Partial<StoredStakeholder> = {}): StoredStakeholder {
  return {
    archived_at: null,
    description: "",
    id: "stakeholder-1",
    name: "Product Manager",
    project_id: "project-1",
    type: "INTERNAL",
    ...overrides
  };
}
