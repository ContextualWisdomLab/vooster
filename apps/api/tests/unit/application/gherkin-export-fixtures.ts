import type { GherkinExportDeps } from "../../../src/application/gherkin-export.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

export function depsFor(
  options: {
    membership?: StoredMembership | null;
    readRevisionEntityIds?: string[];
    scenarios?: StoredScenario[];
    stepsByScenario?: Map<string, StoredStep[]>;
    usecase?: StoredUseCase | null;
  } = {}
): GherkinExportDeps {
  const usecaseValue = "usecase" in options ? (options.usecase ?? null) : usecase();
  const stepsByScenario = options.stepsByScenario ?? defaultSteps();
  return {
    actorStore: {
      findActorById: (_projectId, actorId) =>
        Promise.resolve(actorId === "actor-1" ? actor() : undefined)
    } as GherkinExportDeps["actorStore"],
    membershipStore: {
      membershipForProject: () =>
        Promise.resolve(
          "membership" in options ? (options.membership ?? undefined) : membership()
        )
    } as unknown as GherkinExportDeps["membershipStore"],
    revisionStore: {
      listRevisions: (entityId) => {
        options.readRevisionEntityIds?.push(entityId);
        return Promise.resolve([revision()]);
      }
    } as GherkinExportDeps["revisionStore"],
    scenarioStore: {
      findMainScenario: () =>
        Promise.resolve(
          (options.scenarios ?? scenarios()).find(
            (scenario) => scenario.type === "MAIN_SUCCESS"
          )
        ),
      listScenarios: () => Promise.resolve(options.scenarios ?? scenarios())
    } as unknown as GherkinExportDeps["scenarioStore"],
    stepStore: {
      listSteps: (scenarioId) => Promise.resolve(stepsByScenario.get(scenarioId) ?? [])
    } as GherkinExportDeps["stepStore"],
    useCaseStore: {
      findUseCaseWithProject: () =>
        Promise.resolve(
          usecaseValue === null
            ? undefined
            : { projectId: usecaseValue.project_id, usecase: usecaseValue }
        )
    } as unknown as GherkinExportDeps["useCaseStore"]
  };
}

export function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
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
    scope: "chk",
    status: "DRAFT",
    title: "Places an order",
    ...overrides
  };
}

export function scenarios(): StoredScenario[] {
  return [
    scenario("scenario-main", "MAIN_SUCCESS", null, null),
    scenario("scenario-1b", "EXTENSION", "1b", "Address is incomplete."),
    scenario("scenario-1a", "EXTENSION", "1a", "Payment is declined.")
  ];
}

export function defaultSteps(): Map<string, StoredStep[]> {
  return new Map([
    ["scenario-main", [step("scenario-main", "Places an order.")]],
    ["scenario-1a", [step("scenario-1a", "Uses a backup card.")]],
    ["scenario-1b", [step("scenario-1b", "Adds an address.")]]
  ]);
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

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function revision(): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    snapshot: usecase(),
    version_number: 1
  };
}

export function scenario(
  id: string,
  type: StoredScenario["type"],
  extensionPoint: string | null,
  condition: string | null
): StoredScenario {
  return {
    condition,
    extension_point: extensionPoint,
    id,
    order_index: 0,
    outcome: "FAILURE",
    parent_step_number: 1,
    type,
    usecase_id: "usecase-1"
  };
}

export function step(scenarioId: string, action: string): StoredStep {
  return {
    action,
    actor_id: "actor-1",
    id: `${scenarioId}-step-1`,
    implements: [],
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 1,
    scenario_id: scenarioId,
    step_number: 1
  };
}
