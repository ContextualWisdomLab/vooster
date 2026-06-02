import type { MarkdownExportDeps } from "../../../src/application/markdown-export.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

export function depsFor(
  options: {
    membership?: StoredMembership | null;
    readEntityIds?: string[];
    stepsByScenario?: Map<string, StoredStep[]>;
    usecase?: StoredUseCase | null;
  } = {}
): MarkdownExportDeps {
  const usecaseValue = "usecase" in options ? (options.usecase ?? null) : usecase();
  const stepsByScenario = options.stepsByScenario ?? defaultSteps();
  return {
    actorStore: {
      findActorById: (_projectId, actorId) =>
        Promise.resolve(actorId === "actor-1" ? actor() : undefined)
    } as MarkdownExportDeps["actorStore"],
    membershipStore: {
      membershipForProject: () =>
        Promise.resolve(
          "membership" in options ? (options.membership ?? undefined) : membership()
        )
    } as unknown as MarkdownExportDeps["membershipStore"],
    revisionStore: {
      listRevisions: (entityId) => {
        options.readEntityIds?.push(entityId);
        return Promise.resolve([revision()]);
      }
    } as MarkdownExportDeps["revisionStore"],
    scenarioStore: {
      findMainScenario: () => Promise.resolve(mainScenario()),
      listScenarios: () =>
        Promise.resolve([
          mainScenario(),
          extension("scenario-1b", "1b", "Address is incomplete."),
          extension("scenario-any", "*a", "Network is unavailable."),
          extension("scenario-1a", "1a", "Payment is declined.")
        ])
    } as unknown as MarkdownExportDeps["scenarioStore"],
    stakeholderInterestStore: {
      listStakeholderInterests: () => Promise.resolve([stakeholderInterest()])
    } as unknown as MarkdownExportDeps["stakeholderInterestStore"],
    stakeholderStore: {
      findStakeholderById: () => Promise.resolve(stakeholder())
    } as unknown as MarkdownExportDeps["stakeholderStore"],
    stepStore: {
      listSteps: (scenarioId) => Promise.resolve(stepsByScenario.get(scenarioId) ?? [])
    } as MarkdownExportDeps["stepStore"],
    useCaseStore: {
      findUseCaseWithProject: () =>
        Promise.resolve(
          usecaseValue === null
            ? undefined
            : { projectId: usecaseValue.project_id, usecase: usecaseValue }
        )
    } as unknown as MarkdownExportDeps["useCaseStore"]
  };
}

export function usecase(): StoredUseCase {
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
    scope: "checkout",
    status: "DRAFT",
    title: "Places an order"
  };
}

function defaultSteps(): Map<string, StoredStep[]> {
  return new Map([
    ["scenario-main", [step("scenario-main", 1, "Places an order.")]],
    ["scenario-1a", [step("scenario-1a", 1, "Uses a backup card.")]],
    ["scenario-1b", [step("scenario-1b", 1, "Adds an address.")]],
    ["scenario-any", [step("scenario-any", 1, "Retries later.")]]
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

function extension(
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
    description: "Product owner.",
    id: "stakeholder-1",
    name: "Product Manager",
    project_id: "project-1",
    type: "INTERNAL"
  };
}

function stakeholderInterest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Checkout revenue is protected.",
    protection_mechanism: "Complete checkout.",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}

export function step(
  scenarioId: string,
  stepNumber: number,
  action: string
): StoredStep {
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
