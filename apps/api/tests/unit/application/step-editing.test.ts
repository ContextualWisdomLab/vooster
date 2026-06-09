import { describe, expect, test } from "vitest";
import { editStep } from "../../../src/application/step-editing.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import type {
  StoredActor,
  StoredLock,
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";

describe("step editing application", () => {
  test("edits an action, appends a breaking revision, and reports affected sessions", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedSteps: StoredStep[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await editStep(
      depsFor({
        savedRevisions,
        sessions: [
          session({ id: "session-active" }),
          session({ id: "session-completed", status: "COMPLETED" })
        ],
        updatedSteps,
        updatedUseCases
      }),
      input({ action: "Reviews the order." })
    );

    expect(result).toMatchObject({
      affectedSessions: ["session-active"],
      revision: {
        change_summary: "Edited step step-1",
        entity_id: "usecase-1",
        entity_type: "USECASE",
        id: "revision-new",
        severity: "BREAKING",
        version_number: 5
      },
      status: "UPDATED",
      step: {
        action: "Reviews the order.",
        id: "step-1"
      }
    });
    expect(updatedSteps).toMatchObject([
      { action: "Reviews the order.", id: "step-1" }
    ]);
    expect(savedRevisions).toMatchObject([
      { id: "revision-new", severity: "BREAKING" }
    ]);
    expect(updatedUseCases).toMatchObject([
      { current_revision_id: "revision-new", id: "usecase-1" }
    ]);
  });

  test("edits a step actor and rejects unknown actors", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedSteps: StoredStep[] = [];

    const result = await editStep(
      depsFor({ savedRevisions, updatedSteps }),
      input({ actorName: "Support Agent" })
    );

    expect(result).toMatchObject({
      revision: { severity: "BREAKING" },
      status: "UPDATED",
      step: {
        actor_id: "actor-2",
        id: "step-1"
      }
    });
    expect(updatedSteps).toMatchObject([{ actor_id: "actor-2", id: "step-1" }]);
    expect(savedRevisions).toMatchObject([{ severity: "BREAKING" }]);

    await expect(
      editStep(depsFor(), input({ actorName: "Operations" }))
    ).resolves.toEqual({
      knownActors: ["Customer", "Support Agent"],
      status: "UNKNOWN_ACTOR"
    });
  });

  test("edits notes only as cosmetic under a semantic lock", async () => {
    const result = await editStep(
      depsFor({ lock: lock({ mode: "SEMANTIC" }) }),
      input({ action: undefined, notes: "Clarifies the checkout wording." })
    );

    expect(result).toMatchObject({
      revision: { severity: "COSMETIC" },
      status: "UPDATED",
      step: { notes: "Clarifies the checkout wording." }
    });
  });

  test("returns failure statuses before writing", async () => {
    await expect(editStep(depsFor({ step: undefined }), input())).resolves.toEqual({
      status: "STEP_NOT_FOUND"
    });
    await expect(
      editStep(depsFor({ membership: undefined }), input())
    ).resolves.toEqual({
      status: "FORBIDDEN"
    });
    await expect(
      editStep(
        depsFor({ latestRevision: revision({ id: "revision-current" }) }),
        input()
      )
    ).resolves.toEqual({
      baseRevision: "revision-1",
      currentRevision: "revision-current",
      status: "STALE_BASE",
      usecase: usecase()
    });
    await expect(editStep(depsFor(), input({ action: "" }))).resolves.toEqual({
      status: "EMPTY_ACTION"
    });
    await expect(editStep(depsFor(), input())).resolves.toEqual({
      status: "NO_CHANGES"
    });
    await expect(
      editStep(depsFor(), input({ action: "Order is processed." }))
    ).resolves.toEqual({
      action: "Order is processed.",
      status: "PASSIVE_ACTION"
    });
    await expect(
      editStep(depsFor({ lock: lock({ mode: "HARD" }) }), input({ notes: "Blocked." }))
    ).resolves.toEqual({
      lock: lock({ mode: "HARD" }),
      usecase: usecase(),
      status: "HARD_LOCKED"
    });
    await expect(
      editStep(
        depsFor({ lock: lock({ mode: "SEMANTIC" }) }),
        input({ action: "Reviews." })
      )
    ).resolves.toEqual({
      lock: lock({ mode: "SEMANTIC" }),
      usecase: usecase(),
      status: "SEMANTIC_LOCKED"
    });
    await expect(
      editStep(
        depsFor({ lock: lock({ mode: "SEMANTIC" }) }),
        input({ actorName: "Support Agent" })
      )
    ).resolves.toEqual({
      lock: lock({ mode: "SEMANTIC" }),
      usecase: usecase(),
      status: "SEMANTIC_LOCKED"
    });
  });
});

function depsFor(
  options: {
    latestRevision?: StoredRevision;
    lock?: StoredLock;
    membership?: StoredMembership;
    savedRevisions?: StoredRevision[];
    scenario?: StoredScenario;
    sessions?: StoredWorkSession[];
    step?: StoredStep;
    updatedSteps?: StoredStep[];
    updatedUseCases?: StoredUseCase[];
    usecase?: StoredUseCase;
  } = {}
) {
  const foundScenario = "scenario" in options ? options.scenario : scenario();
  const foundUsecase = "usecase" in options ? options.usecase : usecase();
  return {
    actorStore: actorStore(),
    idFactory: () => "revision-new",
    lockStore: lockStore(options.lock),
    membershipStore: membershipStore(
      "membership" in options ? options.membership : membership()
    ),
    revisionStore: revisionStore(options.latestRevision, options.savedRevisions ?? []),
    scenarioStore: scenarioStore(foundScenario),
    stepStore: stepStore(
      "step" in options ? options.step : step(),
      options.updatedSteps ?? []
    ),
    useCaseStore: useCaseStore(
      foundScenario === undefined || foundUsecase === undefined
        ? undefined
        : { projectId: "project-1", usecase: foundUsecase },
      options.updatedUseCases ?? []
    ),
    workSessionStore: workSessionStore(options.sessions ?? [])
  };
}

function input(overrides: Partial<Parameters<typeof editStep>[1]> = {}) {
  return {
    action: undefined,
    actorName: undefined,
    baseRevision: "revision-1",
    force: false,
    notes: undefined,
    stepId: "step-1",
    userId: "user-1",
    ...overrides
  };
}

function actorStore(): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(undefined),
    findActorByName: (_projectId, name) =>
      Promise.resolve(
        name === "Support Agent" ? actor({ id: "actor-2", name }) : undefined
      ),
    listActors: () =>
      Promise.resolve([
        actor({ name: "Customer" }),
        actor({ id: "actor-2", name: "Support Agent" })
      ]),
    saveActor: () => Promise.resolve(),
    updateActor: () => Promise.resolve()
  };
}

function actor(overrides: Partial<StoredActor> = {}): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY",
    ...overrides
  };
}

function lockStore(lock: StoredLock | undefined): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(lock),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
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

function revisionStore(
  latestRevision: StoredRevision | undefined,
  savedRevisions: StoredRevision[]
): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(latestRevision),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(5),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function scenarioStore(scenario: StoredScenario | undefined): ScenarioStore {
  return {
    countScenariosByUseCase: () => Promise.resolve(new Map()),
    findMainScenario: () => Promise.resolve(undefined),
    findScenarioById: () => Promise.resolve(scenario),
    listScenarios: () => Promise.resolve([]),
    saveScenario: () => Promise.resolve()
  };
}

function stepStore(
  step: StoredStep | undefined,
  updatedSteps: StoredStep[]
): StepStore {
  return {
    findStepById: () => Promise.resolve(step),
    listSteps: () => Promise.resolve(step === undefined ? [] : [step]),
    saveStep: () => Promise.resolve(),
    updateStep: (updated) => {
      updatedSteps.push(updated);
      return Promise.resolve();
    }
  };
}

function useCaseStore(
  found: { projectId: string; usecase: StoredUseCase } | undefined,
  updatedUseCases: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(found),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updatedUseCase) => {
      updatedUseCases.push(updatedUseCase);
      return Promise.resolve();
    }
  };
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: () => Promise.resolve(sessions),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function revision(overrides: Partial<StoredRevision> = {}): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    snapshot: usecase(),
    version_number: 4,
    ...overrides
  };
}

function scenario(): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-1",
    order_index: 0,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1"
  };
}

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Places an order.",
    actor_id: "actor-1",
    id: "step-1",
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-1",
    step_number: 1,
    ...overrides,
    implements: overrides.implements ?? []
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
    priority: "P2",
    project_id: "project-1",
    scope: "chk",
    status: "DRAFT",
    title: "Places an order"
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-06-01T00:00:00.000Z",
    holder: "agent-session-1",
    mode: "SEMANTIC",
    reason: "Agent is editing implementation.",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    id: "session-1",
    pinned_revision_id: "revision-1",
    status: "ACTIVE",
    usecase_id: "usecase-1",
    ...overrides
  };
}
