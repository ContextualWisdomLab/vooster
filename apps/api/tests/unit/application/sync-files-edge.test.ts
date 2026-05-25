import { describe, expect, test } from "vitest";
import {
  pushSyncFiles,
  type SyncFileDeps,
  type SyncFileInput
} from "../../../src/application/sync-files.js";
import type {
  StoredMembership,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

describe("sync files edge cases", () => {
  test("dry-run reports skipped and stale files without writes", async () => {
    const result = await pushSyncFiles(depsFor(), {
      dryRun: true,
      files: [file({ path: "specs/MISSING.md" }), file({ baseRevision: "stale" })],
      projectId: "project-1",
      simulateNetworkFailure: false,
      userId: "user-1"
    });

    expect(result).toMatchObject({
      cacheEntries: [],
      results: [
        { current_revision: "", dry_run: true, status: "SKIPPED" },
        {
          current_revision: "revision-1",
          impact: { entity_id: "usecase-1", severity: "BREAKING" },
          status: "CONFLICT"
        }
      ],
      status: "PUSHED"
    });
  });

  test("push reports skipped files without writes", async () => {
    const result = await pushSyncFiles(depsFor(), {
      dryRun: false,
      files: [file({ path: "specs/MISSING.md" })],
      projectId: "project-1",
      simulateNetworkFailure: false,
      userId: "user-1"
    });

    expect(result).toMatchObject({
      cacheEntries: [{ path: "specs/MISSING.md", revision: "", status: "SYNCED" }],
      results: [{ current_revision: "", status: "SKIPPED" }],
      status: "PUSHED"
    });
  });
});

function depsFor(): SyncFileDeps {
  return {
    actorStore: {
      archiveActor: () => Promise.resolve(false),
      findActorById: () => Promise.resolve(undefined),
      findActorByName: () => Promise.resolve(undefined),
      listActors: () => Promise.resolve([]),
      saveActor: () => Promise.resolve(),
      updateActor: () => Promise.resolve()
    },
    branchStore: {} as SyncFileDeps["branchStore"],
    membershipStore: {
      membershipForProject: () => Promise.resolve(member()),
      membershipForWorkspace: () => Promise.resolve(undefined),
      membershipsForUser: () => Promise.resolve([]),
      saveMembership: () => Promise.resolve()
    },
    projectStore: {} as SyncFileDeps["projectStore"],
    revisionStore: {} as SyncFileDeps["revisionStore"],
    scenarioStore: {
      countScenariosByUseCase: () => Promise.resolve(new Map()),
      findMainScenario: () => Promise.resolve(undefined),
      findScenarioById: () => Promise.resolve(undefined),
      listScenarios: () => Promise.resolve([]),
      saveScenario: () => Promise.resolve()
    },
    stakeholderInterestStore: {
      deleteStakeholderInterest: () => Promise.resolve(),
      findStakeholderInterestById: () => Promise.resolve(undefined),
      findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
      listStakeholderInterests: () => Promise.resolve([]),
      saveStakeholderInterest: () => Promise.resolve()
    },
    stakeholderStore: {
      findStakeholderById: () => Promise.resolve(undefined),
      findStakeholderByName: () => Promise.resolve(undefined),
      listStakeholders: () => Promise.resolve([]),
      saveStakeholder: () => Promise.resolve(),
      updateStakeholder: () => Promise.resolve()
    },
    stepStore: {
      findStepById: () => Promise.resolve(undefined),
      listSteps: () => Promise.resolve([]),
      saveStep: () => Promise.resolve(),
      updateStep: () => Promise.resolve()
    },
    useCaseStore: {
      findUseCaseById: () => Promise.resolve(undefined),
      findUseCaseWithProject: () => Promise.resolve(undefined),
      findUseCasesByKey: () => Promise.resolve([]),
      listUseCases: () => Promise.resolve([usecase()]),
      saveUseCase: () => Promise.resolve(),
      updateUseCase: () => Promise.resolve()
    }
  };
}

function file(overrides: Partial<SyncFileInput> = {}): SyncFileInput {
  return {
    baseRevision: "revision-1",
    content: "---\nrevision: revision-1\n---\n\n# Reviews a refund\n",
    path: "specs/CHK-001.md",
    ...overrides
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

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "IN_SCOPE",
    status: "DRAFT",
    title: "Reviews a refund"
  };
}
