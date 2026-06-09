import { describe, expect, test } from "vitest";
import {
  addScenarioStep,
  createScenario
} from "../../../src/application/scenario-authoring.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStakeholderInterest,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

describe("scenario authoring application", () => {
  test("creates the main success scenario and appends a use case revision", async () => {
    const savedScenarios: StoredScenario[] = [];
    const savedRevisions: StoredRevision[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await createScenario(
      depsFor({ savedRevisions, savedScenarios, updatedUseCases }),
      {
        type: "MAIN_SUCCESS",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected scenario to be created");
    }
    expect(result.scenario).toEqual({
      condition: null,
      extension_point: null,
      id: "id-1",
      order_index: 0,
      outcome: "SUCCESS",
      parent_step_number: null,
      type: "MAIN_SUCCESS",
      usecase_id: "usecase-1"
    });
    expect(result.revision).toMatchObject({
      change_summary: "Created main success scenario id-1",
      entity_id: "usecase-1",
      entity_type: "USECASE",
      id: "id-2",
      severity: "NON_BREAKING",
      version_number: 2
    });
    expect(result.steps).toEqual([]);
    expect(savedScenarios).toEqual([result.scenario]);
    expect(savedRevisions).toEqual([result.revision]);
    expect(updatedUseCases).toMatchObject([
      { current_revision_id: result.revision.id, id: "usecase-1" }
    ]);
  });

  test("rejects duplicate main success scenarios without writing", async () => {
    const savedScenarios: StoredScenario[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await createScenario(
      depsFor({
        existingScenarios: [mainScenario()],
        savedRevisions,
        savedScenarios
      }),
      {
        type: "MAIN_SUCCESS",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      existingScenario: mainScenario(),
      status: "DUPLICATE_MAIN_SUCCESS"
    });
    expect(savedScenarios).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("reports missing use cases before writing scenarios", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(depsFor({ savedScenarios, usecase: null }), {
      type: "MAIN_SUCCESS",
      usecaseId: "missing-usecase",
      userId: "user-1"
    });

    expect(result).toEqual({ status: "USECASE_NOT_FOUND" });
    expect(savedScenarios).toEqual([]);
  });

  test("requires project membership before writing scenarios", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(
      depsFor({ hasMembership: false, savedScenarios }),
      {
        type: "MAIN_SUCCESS",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(savedScenarios).toEqual([]);
  });

  test("requires a stakeholder interest before creating the main success scenario", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(
      depsFor({ savedScenarios, stakeholderInterests: [] }),
      {
        type: "MAIN_SUCCESS",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      status: "MISSING_STAKEHOLDER_INTEREST",
      usecaseKey: "PAY-001"
    });
    expect(savedScenarios).toEqual([]);
  });

  test("creates an extension scenario with the default outcome warning", async () => {
    const savedScenarios: StoredScenario[] = [];
    const updatedUseCases: StoredUseCase[] = [];
    const result = await createScenario(
      depsFor({
        existingScenarios: [mainScenario()],
        existingSteps: [step()],
        savedScenarios,
        updatedUseCases
      }),
      {
        condition: "Payment is declined.",
        extensionPoint: "1a",
        type: "EXTENSION",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected extension to be created");
    }
    expect(result.scenario).toMatchObject({
      condition: "Payment is declined.",
      extension_point: "1a",
      order_index: 1,
      outcome: "FAILURE",
      parent_step_number: 1,
      type: "EXTENSION"
    });
    expect(result.defaultOutcome).toBe(true);
    expect(savedScenarios).toEqual([result.scenario]);
    expect(updatedUseCases).toMatchObject([
      { current_revision_id: result.revision.id, id: "usecase-1" }
    ]);
  });

  test("requires extension scenario condition and point together", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(
      depsFor({ existingScenarios: [mainScenario()], savedScenarios }),
      {
        condition: "Payment is declined.",
        type: "EXTENSION",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "INVALID_EXTENSION_REQUEST" });
    expect(savedScenarios).toEqual([]);
  });

  test("rejects malformed extension points before writing", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(
      depsFor({ existingScenarios: [mainScenario()], savedScenarios }),
      {
        condition: "Payment is declined.",
        extensionPoint: "step-3a",
        type: "EXTENSION",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "INVALID_EXTENSION_POINT" });
    expect(savedScenarios).toEqual([]);
  });

  test("rejects extension points outside the main scenario steps", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(
      depsFor({
        existingScenarios: [mainScenario()],
        existingSteps: [step({ step_number: 1 })],
        savedScenarios
      }),
      {
        condition: "Payment is declined.",
        extensionPoint: "3a",
        type: "EXTENSION",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      parentStepNumber: 3,
      status: "EXTENSION_PARENT_OUT_OF_RANGE",
      usecaseKey: "PAY-001"
    });
    expect(savedScenarios).toEqual([]);
  });

  test("allows global extension points without a parent step", async () => {
    const savedScenarios: StoredScenario[] = [];

    const result = await createScenario(
      depsFor({
        existingScenarios: [mainScenario()],
        savedScenarios
      }),
      {
        condition: "The service is unavailable.",
        extensionPoint: "*a",
        outcome: "PARTIAL",
        type: "EXTENSION",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected global extension to be created");
    }
    expect(result.defaultOutcome).toBe(false);
    expect(result.scenario).toMatchObject({
      extension_point: "*a",
      outcome: "PARTIAL",
      parent_step_number: null
    });
  });

  test("rejects duplicate extension points without writing", async () => {
    const savedScenarios: StoredScenario[] = [];
    const result = await createScenario(
      depsFor({
        existingScenarios: [
          mainScenario(),
          extensionScenario({
            condition: "Payment is declined.",
            extension_point: "1a"
          })
        ],
        existingSteps: [step()],
        savedScenarios
      }),
      {
        condition: "Inventory is unavailable.",
        extensionPoint: "1a",
        outcome: "FAILURE",
        type: "EXTENSION",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      existingCondition: "Payment is declined.",
      status: "DUPLICATE_EXTENSION_POINT",
      suggestedExtensionPoint: "1b"
    });
    expect(savedScenarios).toEqual([]);
  });

  test("adds a scenario step with contiguous numbering and a revision", async () => {
    const savedSteps: StoredStep[] = [];
    const savedRevisions: StoredRevision[] = [];
    const updatedUseCases: StoredUseCase[] = [];

    const result = await addScenarioStep(
      depsFor({
        existingScenarios: [mainScenario()],
        existingSteps: [step({ id: "step-1", step_number: 1 })],
        savedRevisions,
        savedSteps,
        updatedUseCases
      }),
      {
        action: "Reviews the order.",
        actorName: "Customer",
        force: false,
        scenarioId: "scenario-main",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("STEP_ADDED");
    if (result.status !== "STEP_ADDED") {
      throw new Error("expected step to be added");
    }
    expect(result.step).toMatchObject({
      action: "Reviews the order.",
      actor_id: "actor-customer",
      id: "id-1",
      order_index: 1,
      scenario_id: "scenario-main",
      step_number: 2
    });
    expect(result.scenarioSteps.map((item) => item.step_number)).toEqual([1, 2]);
    expect(result.revision.change_summary).toBe(
      "Added step 2 to main success scenario"
    );
    expect(savedSteps).toEqual([result.step]);
    expect(savedRevisions).toEqual([result.revision]);
    expect(updatedUseCases).toMatchObject([
      { current_revision_id: result.revision.id, id: "usecase-1" }
    ]);
  });

  test("rejects unresolved step actors without writing", async () => {
    const savedSteps: StoredStep[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await addScenarioStep(
      depsFor({
        existingScenarios: [mainScenario()],
        savedRevisions,
        savedSteps
      }),
      {
        action: "Reviews the order.",
        actorName: "Support Agent",
        force: false,
        scenarioId: "scenario-main",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      knownActors: ["Customer"],
      status: "UNKNOWN_STEP_ACTOR"
    });
    expect(savedSteps).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("reports missing scenarios before adding a step", async () => {
    const savedSteps: StoredStep[] = [];

    const result = await addScenarioStep(depsFor({ savedSteps }), {
      action: "Reviews the order.",
      actorName: "Customer",
      force: false,
      scenarioId: "missing-scenario",
      userId: "user-1"
    });

    expect(result).toEqual({ status: "SCENARIO_NOT_FOUND" });
    expect(savedSteps).toEqual([]);
  });

  test("requires project membership before adding a step", async () => {
    const savedSteps: StoredStep[] = [];

    const result = await addScenarioStep(
      depsFor({
        existingScenarios: [mainScenario()],
        hasMembership: false,
        savedSteps
      }),
      {
        action: "Reviews the order.",
        actorName: "Customer",
        force: false,
        scenarioId: "scenario-main",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(savedSteps).toEqual([]);
  });

  test("warns on passive step actions unless forced", async () => {
    const savedSteps: StoredStep[] = [];

    const result = await addScenarioStep(
      depsFor({
        existingScenarios: [mainScenario()],
        savedSteps
      }),
      {
        action: "Order is submitted.",
        actorName: "Customer",
        force: false,
        scenarioId: "scenario-main",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      status: "PASSIVE_ACTION",
      suggestedAction: "Submits the order."
    });
    expect(savedSteps).toEqual([]);
  });

  test("marks steps beyond nine with a split warning flag", async () => {
    const existingSteps = Array.from({ length: 9 }, (_, index) =>
      step({
        id: `step-${String(index + 1)}`,
        order_index: index,
        step_number: index + 1
      })
    );

    const result = await addScenarioStep(
      depsFor({
        existingScenarios: [mainScenario()],
        existingSteps
      }),
      {
        action: "Reviews the order.",
        actorName: "Customer",
        force: false,
        scenarioId: "scenario-main",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("STEP_ADDED");
    if (result.status !== "STEP_ADDED") {
      throw new Error("expected tenth step to be added");
    }
    expect(result.overNineSteps).toBe(true);
    expect(result.step.step_number).toBe(10);
  });
});

function depsFor(
  options: {
    existingScenarios?: StoredScenario[];
    existingSteps?: StoredStep[];
    hasMembership?: boolean;
    savedRevisions?: StoredRevision[];
    savedScenarios?: StoredScenario[];
    savedSteps?: StoredStep[];
    stakeholderInterests?: StoredStakeholderInterest[];
    updatedUseCases?: StoredUseCase[];
    usecase?: StoredUseCase | null;
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
    scenarioStore: scenarioStore(
      options.existingScenarios ?? [],
      options.savedScenarios ?? []
    ),
    stakeholderInterestStore: stakeholderInterestStore(
      options.stakeholderInterests ?? [stakeholderInterest()]
    ),
    stepStore: stepStore(options.existingSteps ?? [], options.savedSteps ?? []),
    useCaseStore: useCaseStore(
      options.usecase === undefined ? usecase() : options.usecase,
      options.updatedUseCases ?? []
    )
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

function scenarioStore(
  existingScenarios: StoredScenario[],
  savedScenarios: StoredScenario[]
): ScenarioStore {
  return {
    countScenariosByUseCase: () => Promise.resolve(new Map()),
    findMainScenario: () =>
      Promise.resolve(
        existingScenarios.find((scenario) => scenario.type === "MAIN_SUCCESS")
      ),
    findScenarioById: (scenarioId) =>
      Promise.resolve(
        existingScenarios.concat(savedScenarios).find((item) => item.id === scenarioId)
      ),
    listScenarios: () => Promise.resolve(existingScenarios.concat(savedScenarios)),
    saveScenario: (scenario) => {
      savedScenarios.push(scenario);
      return Promise.resolve();
    }
  };
}

function stakeholderInterestStore(
  interests: StoredStakeholderInterest[]
): StakeholderInterestStore {
  return {
    deleteStakeholderInterest: () => Promise.resolve(),
    findStakeholderInterestById: () => Promise.resolve(undefined),
    findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
    listStakeholderInterests: () => Promise.resolve(interests),
    saveStakeholderInterest: () => Promise.resolve()
  };
}

function stepStore(existingSteps: StoredStep[], savedSteps: StoredStep[]): StepStore {
  return {
    findStepById: () => Promise.resolve(undefined),
    listSteps: () => Promise.resolve(existingSteps.concat(savedSteps)),
    saveStep: (newStep) => {
      savedSteps.push(newStep);
      return Promise.resolve();
    },
    updateStep: () => Promise.resolve()
  };
}

function useCaseStore(
  foundUseCase: StoredUseCase | null,
  updatedUseCases: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(
        foundUseCase === null
          ? undefined
          : { projectId: "project-1", usecase: foundUseCase }
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updatedUseCase) => {
      updatedUseCases.push(updatedUseCase);
      return Promise.resolve();
    }
  };
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

function extensionScenario(overrides: Partial<StoredScenario>): StoredScenario {
  return {
    condition: "Payment is declined.",
    extension_point: "1a",
    id: "scenario-extension",
    order_index: 1,
    outcome: "FAILURE",
    parent_step_number: 1,
    type: "EXTENSION",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Places an order.",
    actor_id: "actor-customer",
    id: "step-1",
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-main",
    step_number: 1,
    ...overrides,
    implements: overrides.implements ?? []
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
