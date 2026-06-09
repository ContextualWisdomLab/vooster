import { describe, expect, test } from "vitest";
import {
  addScenarioStep,
  moveScenarioStep
} from "../../../src/application/scenario-authoring.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStakeholderInterest,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("scenario step positioning", () => {
  test("omitting a position keeps append behavior", async () => {
    const existingSteps = [
      step({ id: "step-1", order_index: 0, step_number: 1 }),
      step({ id: "step-2", order_index: 1, step_number: 2 })
    ];

    const result = await addScenarioStep(
      depsFor({ existingSteps }),
      addInput({ action: "Confirms the order." })
    );

    expect(result.status).toBe("STEP_ADDED");
    if (result.status !== "STEP_ADDED") {
      throw new Error("expected step to be added");
    }
    expect(result.step.step_number).toBe(3);
    expect(stepIds(result.scenarioSteps)).toEqual(["step-1", "step-2", "id-1"]);
    expectContiguous(result.scenarioSteps);
  });

  test("inserts a new step at the first position", async () => {
    const updatedSteps: StoredStep[] = [];
    const result = await addScenarioStep(
      depsFor({
        existingSteps: [
          step({ id: "step-1", order_index: 0, step_number: 1 }),
          step({ id: "step-2", order_index: 1, step_number: 2 })
        ],
        updatedSteps
      }),
      addInput({ action: "Validates the amount.", position: 1 })
    );

    expect(result.status).toBe("STEP_ADDED");
    if (result.status !== "STEP_ADDED") {
      throw new Error("expected step to be added");
    }
    expect(stepIds(result.scenarioSteps)).toEqual(["id-1", "step-1", "step-2"]);
    expect(result.step).toMatchObject({
      action: "Validates the amount.",
      step_number: 1
    });
    expectContiguous(result.scenarioSteps);
    expect(updatedSteps.map((item) => item.step_number)).toEqual([2, 3]);
  });

  test("inserts a new step in the middle", async () => {
    const result = await addScenarioStep(
      depsFor({
        existingSteps: [
          step({ id: "step-1", order_index: 0, step_number: 1 }),
          step({ id: "step-2", order_index: 1, step_number: 2 }),
          step({ id: "step-3", order_index: 2, step_number: 3 })
        ]
      }),
      addInput({ action: "Applies fraud checks.", position: 2 })
    );

    expect(result.status).toBe("STEP_ADDED");
    if (result.status !== "STEP_ADDED") {
      throw new Error("expected step to be added");
    }
    expect(stepIds(result.scenarioSteps)).toEqual([
      "step-1",
      "id-1",
      "step-2",
      "step-3"
    ]);
    expect(result.step.step_number).toBe(2);
    expectContiguous(result.scenarioSteps);
  });

  test("clamps insert positions past the end to append", async () => {
    const result = await addScenarioStep(
      depsFor({
        existingSteps: [
          step({ id: "step-1", order_index: 0, step_number: 1 }),
          step({ id: "step-2", order_index: 1, step_number: 2 })
        ]
      }),
      addInput({ action: "Sends the receipt.", position: 99 })
    );

    expect(result.status).toBe("STEP_ADDED");
    if (result.status !== "STEP_ADDED") {
      throw new Error("expected step to be added");
    }
    expect(stepIds(result.scenarioSteps)).toEqual(["step-1", "step-2", "id-1"]);
    expect(result.step.step_number).toBe(3);
    expectContiguous(result.scenarioSteps);
  });

  test("moves an existing step and preserves its content", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedSteps: StoredStep[] = [];
    const updatedUseCases: StoredUseCase[] = [];
    const result = await moveScenarioStep(
      depsFor({
        existingSteps: [
          step({
            action: "Collects the amount.",
            id: "step-1",
            order_index: 0,
            step_number: 1
          }),
          step({
            action: "Saves the expense.",
            id: "step-2",
            notes: "Keep audit metadata.",
            order_index: 1,
            step_number: 2
          }),
          step({
            action: "Confirms the save.",
            id: "step-3",
            order_index: 2,
            step_number: 3
          })
        ],
        savedRevisions,
        updatedSteps,
        updatedUseCases
      }),
      {
        stepId: "step-2",
        toPosition: 1,
        userId: "user-1"
      }
    );

    expect(result.status).toBe("STEP_MOVED");
    if (result.status !== "STEP_MOVED") {
      throw new Error("expected step to be moved");
    }
    expect(stepIds(result.scenarioSteps)).toEqual(["step-2", "step-1", "step-3"]);
    expect(result.step).toMatchObject({
      action: "Saves the expense.",
      actor_id: "actor-customer",
      notes: "Keep audit metadata.",
      step_number: 1
    });
    expectContiguous(result.scenarioSteps);
    expect(updatedSteps.map((item) => item.id)).toEqual(["step-2", "step-1"]);
    expect(savedRevisions).toHaveLength(1);
    expect(savedRevisions[0]?.change_summary).toBe("Moved step step-2 to position 1");
    expect(updatedUseCases).toMatchObject([
      { current_revision_id: result.revision.id, id: "usecase-1" }
    ]);
  });

  test("requires membership before moving a step", async () => {
    const updatedSteps: StoredStep[] = [];
    const result = await moveScenarioStep(
      depsFor({
        existingSteps: [step({ id: "step-1" })],
        hasMembership: false,
        updatedSteps
      }),
      { stepId: "step-1", toPosition: 1, userId: "user-1" }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(updatedSteps).toEqual([]);
  });
});

function addInput(overrides: { action: string; position?: number }) {
  return {
    action: overrides.action,
    actorName: "Customer",
    force: false,
    position: overrides.position,
    scenarioId: "scenario-main",
    userId: "user-1"
  };
}

function depsFor(
  options: {
    existingSteps?: StoredStep[];
    hasMembership?: boolean;
    savedRevisions?: StoredRevision[];
    savedSteps?: StoredStep[];
    updatedUseCases?: StoredUseCase[];
    updatedSteps?: StoredStep[];
  } = {}
) {
  let nextId = 0;
  return {
    actorStore: actorStore(),
    idFactory: () => {
      nextId += 1;
      return `id-${String(nextId)}`;
    },
    membershipStore: membershipStore(options.hasMembership ?? true),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    scenarioStore: scenarioStore(),
    stakeholderInterestStore: stakeholderInterestStore(),
    stepStore: stepStore(
      options.existingSteps ?? [],
      options.savedSteps ?? [],
      options.updatedSteps ?? []
    ),
    useCaseStore: useCaseStore(options.updatedUseCases ?? [])
  };
}

function actorStore(): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(undefined),
    findActorByName: (_projectId, name) =>
      Promise.resolve(name === "Customer" ? actor() : undefined),
    listActors: () => Promise.resolve([actor()]),
    saveActor: () => Promise.resolve()
  };
}

function membershipStore(hasMembership: boolean): MembershipStore {
  return {
    membershipForProject: () =>
      Promise.resolve(hasMembership ? membership() : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(2),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function scenarioStore(): ScenarioStore {
  return {
    countScenariosByUseCase: () => Promise.resolve(new Map()),
    findMainScenario: () => Promise.resolve(scenario()),
    findScenarioById: (scenarioId) =>
      Promise.resolve(scenarioId === "scenario-main" ? scenario() : undefined),
    listScenarios: () => Promise.resolve([scenario()]),
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

function stepStore(
  existingSteps: StoredStep[],
  savedSteps: StoredStep[],
  updatedSteps: StoredStep[]
): StepStore {
  return {
    findStepById: (stepId) =>
      Promise.resolve(
        existingSteps
          .concat(savedSteps, updatedSteps)
          .find((step) => step.id === stepId)
      ),
    listSteps: () => Promise.resolve(existingSteps.concat(savedSteps)),
    saveStep: (newStep) => {
      savedSteps.push(newStep);
      return Promise.resolve();
    },
    updateStep: (updatedStep) => {
      updatedSteps.push(updatedStep);
      return Promise.resolve();
    }
  };
}

function useCaseStore(updatedUseCases: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve({ projectId: "project-1", usecase: usecase() }),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updatedUseCase) => {
      updatedUseCases.push(updatedUseCase);
      return Promise.resolve();
    }
  };
}

function expectContiguous(steps: StoredStep[]) {
  expect(steps.map((item) => item.step_number)).toEqual(
    steps.map((_item, index) => index + 1)
  );
  expect(steps.map((item) => item.order_index)).toEqual(
    steps.map((_item, index) => index)
  );
}

function stepIds(steps: StoredStep[]): string[] {
  return steps.map((item) => item.id);
}

function actor(): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "",
    id: "actor-customer",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY"
  };
}

function scenario(): StoredScenario {
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

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Places an order.",
    actor_id: "actor-customer",
    id: "step-1",
    implements: [],
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-main",
    step_number: 1,
    ...overrides
  };
}

function stakeholderInterest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Checkout revenue is protected.",
    protection_mechanism: "",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-customer",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Places an order"
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
