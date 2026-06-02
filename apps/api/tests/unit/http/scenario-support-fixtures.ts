import type {
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

export function scenario(overrides: Partial<StoredScenario> = {}): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-1",
    order_index: 0,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1",
    ...overrides
  };
}

export function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Buyer submits the order.",
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

export function storedUseCase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order"
  };
}

export function useCaseRevision() {
  return {
    change_summary: "Added step",
    entity_id: "usecase-1",
    entity_type: "USECASE" as const,
    id: "revision-1",
    severity: "NON_BREAKING" as const,
    snapshot: storedUseCase(),
    version_number: 2
  };
}

export function scenarioStore(options: {
  byId?: StoredScenario;
  main?: StoredScenario;
}): ScenarioStore {
  return {
    findMainScenario: () => Promise.resolve(options.main),
    findScenarioById: () => Promise.resolve(options.byId)
  } as unknown as ScenarioStore;
}

export function stepStore(steps: StoredStep[]): StepStore {
  return {
    listSteps: () => Promise.resolve(steps)
  } as unknown as StepStore;
}

export function useCaseStore(usecase: StoredUseCase | undefined): UseCaseStore {
  return {
    findUseCaseWithProject: () =>
      Promise.resolve(
        usecase === undefined ? undefined : { projectId: usecase.project_id, usecase }
      )
  } as unknown as UseCaseStore;
}

export function revisionStore(saved: StoredRevision[]): RevisionStore {
  return {
    nextVersionNumber: () => Promise.resolve(3),
    saveRevision: (revision: StoredRevision) => {
      saved.push(revision);
      return Promise.resolve();
    }
  } as unknown as RevisionStore;
}
