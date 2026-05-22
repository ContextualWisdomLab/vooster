import { describe, expect, test } from "vitest";
import {
  pullSyncFiles,
  pushSyncFiles,
  type SyncFileInput
} from "../../../src/application/sync-files.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type {
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

describe("sync files application", () => {
  test("pull returns canonical markdown for active use cases", async () => {
    const result = await pullSyncFiles(depsFor(), {
      projectId: "project-1",
      userId: "user-1"
    });

    expect(result).toMatchObject({
      cursor: "revision-1",
      files: [
        {
          path: "specs/CHK-001.md",
          revision: "revision-1"
        }
      ],
      status: "PULLED"
    });
    if (result.status !== "PULLED") {
      throw new Error("expected pulled result");
    }
    expect(result.files[0]?.content).toContain("revision: revision-1");
    expect(result.files[0]?.content).toContain("# Reviews a refund");
  });

  test("push writes revisions and advances the main branch for clean files", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedUseCases: StoredUseCase[] = [];
    const updatedBranches: StoredSpecBranch[] = [];

    const result = await pushSyncFiles(
      depsFor({ savedRevisions, updatedBranches, updatedUseCases }),
      {
        dryRun: false,
        files: [
          file({
            content: markdown("Reviews a refund quickly")
          })
        ],
        projectId: "project-1",
        simulateNetworkFailure: false,
        userId: "user-1"
      }
    );

    expect(result).toMatchObject({
      cacheEntries: [
        {
          path: "specs/CHK-001.md",
          revision: "revision-new",
          status: "SYNCED"
        }
      ],
      results: [
        {
          current_revision: "revision-new",
          path: "specs/CHK-001.md",
          status: "OK"
        }
      ],
      status: "PUSHED",
      suggestedNextActions: [
        {
          command: "vspec pull",
          reason: "Refresh local files after successful push."
        }
      ]
    });
    expect(savedRevisions).toMatchObject([
      {
        change_summary: "Synced CHK-001 from file",
        entity_id: "usecase-1",
        id: "revision-new",
        parent_revision_id: "revision-1",
        severity: "NON_BREAKING",
        snapshot: { title: "Reviews a refund quickly" },
        version_number: 2
      }
    ]);
    expect(updatedUseCases).toMatchObject([
      {
        current_revision_id: "revision-new",
        title: "Reviews a refund quickly"
      }
    ]);
    expect(updatedBranches[0]?.head_revision_ids).toEqual({
      "usecase-1": "revision-new"
    });
  });

  test("dry-run and stale files do not write revisions", async () => {
    const savedRevisions: StoredRevision[] = [];
    const dryRun = await pushSyncFiles(depsFor({ savedRevisions }), {
      dryRun: true,
      files: [file()],
      projectId: "project-1",
      simulateNetworkFailure: false,
      userId: "user-1"
    });
    const stale = await pushSyncFiles(depsFor({ savedRevisions }), {
      dryRun: false,
      files: [file({ baseRevision: "revision-stale" })],
      projectId: "project-1",
      simulateNetworkFailure: false,
      userId: "user-1"
    });

    expect(dryRun).toMatchObject({
      cacheEntries: [],
      results: [{ current_revision: "revision-1", dry_run: true, status: "OK" }],
      status: "PUSHED"
    });
    expect(stale).toMatchObject({
      cacheEntries: [
        {
          path: "specs/CHK-001.md",
          revision: "revision-1",
          status: "UNRESOLVED"
        }
      ],
      results: [
        {
          current_revision: "revision-1",
          impact: { entity_id: "usecase-1", severity: "BREAKING" },
          status: "CONFLICT"
        }
      ],
      status: "PUSHED"
    });
    expect(savedRevisions).toEqual([]);
  });

  test("returns failure statuses before writes", async () => {
    await expect(
      pullSyncFiles(depsFor({ membership: undefined }), {
        projectId: "project-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      pushSyncFiles(depsFor({ membership: undefined }), {
        dryRun: false,
        files: [file()],
        projectId: "project-1",
        simulateNetworkFailure: false,
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      pushSyncFiles(depsFor(), {
        dryRun: false,
        files: [file()],
        projectId: "project-1",
        simulateNetworkFailure: true,
        userId: "user-1"
      })
    ).resolves.toEqual({
      files: [{ base_revision: "revision-1", path: "specs/CHK-001.md" }],
      status: "NETWORK_FAILURE"
    });
  });
});

function depsFor(
  options: {
    membership?: StoredMembership;
    savedRevisions?: StoredRevision[];
    updatedBranches?: StoredSpecBranch[];
    updatedUseCases?: StoredUseCase[];
    usecases?: StoredUseCase[];
  } = {}
) {
  const branch = mainBranch();
  return {
    branchStore: branchStore(branch, options.updatedBranches ?? []),
    idFactory: () => "revision-new",
    membershipStore: membershipStore(
      "membership" in options ? options.membership : member()
    ),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    useCaseStore: useCaseStore(
      options.usecases ?? [
        usecase(),
        usecase({ archived_at: "2026-05-20T00:00:00.000Z", id: "archived-1" })
      ],
      options.updatedUseCases ?? []
    )
  };
}

function file(overrides: Partial<SyncFileInput> = {}): SyncFileInput {
  return {
    baseRevision: "revision-1",
    content: markdown("Reviews a refund"),
    path: "specs/CHK-001.md",
    ...overrides
  };
}

function markdown(title: string) {
  return `---\nrevision: revision-1\n---\n\n# ${title}\n`;
}

function branchStore(
  branch: StoredSpecBranch,
  updates: StoredSpecBranch[]
): BranchStore {
  return {
    findBranchById: () => Promise.resolve(branch),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: () => Promise.resolve(),
    updateBranch: (updated) => {
      updates.push(updated);
      return Promise.resolve();
    }
  };
}

function membershipStore(membership: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(membership),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(project()),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    deleteProject: () => Promise.resolve("NOT_FOUND" as const),
    updateProjectName: () => Promise.resolve(undefined),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve(savedRevisions),
    nextVersionNumber: () => Promise.resolve(2),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function useCaseStore(
  usecases: StoredUseCase[],
  updates: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(usecases),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updated) => {
      updates.push(updated);
      return Promise.resolve();
    }
  };
}

function member(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
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

function mainBranch(): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: {},
    id: "branch-main",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
  };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P2",
    project_id: "project-1",
    scope: "chk",
    status: "DRAFT",
    title: "Reviews a refund",
    ...overrides
  };
}
