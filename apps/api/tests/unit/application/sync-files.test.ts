import { describe, expect, test } from "vitest";
import {
  pullSyncFiles,
  pushSyncFiles,
  type SyncFileInput
} from "../../../src/application/sync-files.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type {
  StoredActor,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredScenario,
  StoredSpecBranch,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredStep,
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
    expect(result.files[0]?.content).toContain("primary_actor: Customer");
    expect(result.files[0]?.content).toContain(
      "## Stakeholders and Interests\n\n- **Product Manager**: Refund risk is visible."
    );
    expect(result.files[0]?.content).toContain("## Preconditions\n\n- None recorded.");
    expect(result.files[0]?.content).toContain("## Trigger\n\nNot recorded.");
    expect(result.files[0]?.content).toContain(
      "## Main Success Scenario\n\n1. **Customer** Reviews refund request."
    );
    expect(result.files[0]?.content).toContain(
      "### 1a. Receipt is missing.\n\n- 1a1. **Customer** Uploads receipt."
    );
    expect(result.files[0]?.content).toContain("## Success Guarantee\n\nNot recorded.");
    expect(result.files[0]?.content).toContain("## Minimal Guarantee\n\nNot recorded.");
    expect(result.files[0]?.content).toMatch(/## Notes\n$/);
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
    actorStore: actorStore(),
    branchStore: branchStore(branch, options.updatedBranches ?? []),
    idFactory: () => "revision-new",
    membershipStore: membershipStore(
      "membership" in options ? options.membership : member()
    ),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    scenarioStore: scenarioStore(),
    stakeholderInterestStore: stakeholderInterestStore(),
    stakeholderStore: stakeholderStore(),
    stepStore: stepStore(),
    useCaseStore: useCaseStore(
      options.usecases ?? [
        usecase(),
        usecase({ archived_at: "2026-05-20T00:00:00.000Z", id: "archived-1" })
      ],
      options.updatedUseCases ?? []
    )
  };
}

function actorStore(): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(actor()),
    findActorByName: () => Promise.resolve(actor()),
    listActors: () => Promise.resolve([actor()]),
    saveActor: () => Promise.resolve(),
    updateActor: () => Promise.resolve()
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

function scenarioStore(): ScenarioStore {
  return {
    countScenariosByUseCase: () => Promise.resolve(new Map()),
    findMainScenario: () => Promise.resolve(mainScenario()),
    findScenarioById: () => Promise.resolve(undefined),
    listScenarios: () =>
      Promise.resolve([
        mainScenario(),
        extensionScenario("scenario-1a", "1a", "Receipt is missing.")
      ]),
    saveScenario: () => Promise.resolve()
  };
}

function stakeholderInterestStore(): StakeholderInterestStore {
  return {
    deleteStakeholderInterest: () => Promise.resolve(),
    findStakeholderInterestById: () => Promise.resolve(undefined),
    findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
    listStakeholderInterests: () => Promise.resolve([stakeholderInterest()]),
    saveStakeholderInterest: () => Promise.resolve()
  };
}

function stakeholderStore(): StakeholderStore {
  return {
    findStakeholderById: () => Promise.resolve(stakeholder()),
    findStakeholderByName: () => Promise.resolve(stakeholder()),
    listStakeholders: () => Promise.resolve([stakeholder()]),
    saveStakeholder: () => Promise.resolve(),
    updateStakeholder: () => Promise.resolve()
  };
}

function stepStore(): StepStore {
  return {
    findStepById: () => Promise.resolve(undefined),
    listSteps: (scenarioId) =>
      Promise.resolve(
        scenarioId === "scenario-main"
          ? [step("scenario-main", 1, "Reviews refund request.")]
          : [step("scenario-1a", 1, "Uploads receipt.")]
      ),
    saveStep: () => Promise.resolve(),
    updateStep: () => Promise.resolve()
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

function actor(): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "A customer.",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY"
  };
}

function mainScenario(): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-main",
    order_index: 0,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1"
  };
}

function extensionScenario(
  id: string,
  extensionPoint: string,
  condition: string
): StoredScenario {
  return {
    condition,
    extension_point: extensionPoint,
    id,
    order_index: 1,
    outcome: "FAILURE",
    parent_step_number: 1,
    type: "EXTENSION",
    usecase_id: "usecase-1"
  };
}

function stakeholder(): StoredStakeholder {
  return {
    archived_at: null,
    description: "Owns refund policy.",
    id: "stakeholder-1",
    name: "Product Manager",
    project_id: "project-1",
    type: "INTERNAL"
  };
}

function stakeholderInterest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Refund risk is visible.",
    protection_mechanism: "Review refund requests.",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}

function step(scenarioId: string, stepNumber: number, action: string): StoredStep {
  return {
    action,
    actor_id: "actor-1",
    id: `${scenarioId}-step-${String(stepNumber)}`,
    implements: [],
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: stepNumber,
    scenario_id: scenarioId,
    step_number: stepNumber
  };
}
