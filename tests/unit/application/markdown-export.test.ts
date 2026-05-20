import { describe, expect, test } from "vitest";
import { exportMarkdown } from "../../../src/application/markdown-export.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredStep,
  StoredUseCase
} from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("markdown export application", () => {
  test("renders canonical markdown with sorted extensions", async () => {
    const result = await exportMarkdown(depsFor(), {
      revisionId: "revision-1",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("EXPORTED");
    if (result.status !== "EXPORTED") {
      throw new Error("expected markdown to export");
    }
    expect(result.markdown).toContain("primary_actor: Customer");
    expect(result.markdown).toContain("## Stakeholders and Interests\n\n- **Product Manager**: Checkout revenue is protected.");
    expect(result.markdown).toContain("## Main Success Scenario\n\n1. **Customer** Places an order.");
    expect(result.markdown).toContain("### 1a. Payment is declined.\n\n- 1a1. **Customer** Uses a backup card.");
    expect(result.markdown.indexOf("### 1a. Payment is declined.")).toBeLessThan(
      result.markdown.indexOf("### 1b. Address is incomplete.")
    );
    expect(result.markdown.indexOf("### 1b. Address is incomplete.")).toBeLessThan(
      result.markdown.indexOf("### *a. Network is unavailable.")
    );
  });

  test("rejects missing use cases", async () => {
    await expect(
      exportMarkdown(depsFor({ usecase: null }), {
        revisionId: undefined,
        usecaseId: "missing-usecase",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });
  });

  test("rejects callers without project membership before reading revisions", async () => {
    const readEntityIds: string[] = [];

    const result = await exportMarkdown(
      depsFor({ membership: null, readEntityIds }),
      {
        revisionId: "revision-1",
        usecaseId: "usecase-1",
        userId: "outsider"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(readEntityIds).toEqual([]);
  });

  test("rejects missing requested revisions", async () => {
    await expect(
      exportMarkdown(depsFor(), {
        revisionId: "revision-missing",
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      revisionId: "revision-missing",
      status: "REVISION_NOT_FOUND",
      usecase: usecase()
    });
  });

  test("rejects incomplete main scenarios", async () => {
    await expect(
      exportMarkdown(depsFor({ stepsByScenario: new Map([["scenario-main", []]]) }), {
        revisionId: undefined,
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      status: "INCOMPLETE_USECASE",
      usecase: usecase()
    });
  });
});

function depsFor(
  options: {
    membership?: StoredMembership | null;
    readEntityIds?: string[];
    stepsByScenario?: Map<string, StoredStep[]>;
    usecase?: StoredUseCase | null;
  } = {}
) {
  const usecaseValue = "usecase" in options ? options.usecase ?? null : usecase();
  return {
    actorStore: actorStore(),
    membershipStore: membershipStore(
      "membership" in options ? options.membership ?? null : membership()
    ),
    revisionStore: revisionStore(options.readEntityIds ?? []),
    scenarioStore: scenarioStore(),
    stakeholderInterestStore: stakeholderInterestStore(),
    stakeholderStore: stakeholderStore(),
    stepStore: stepStore(options.stepsByScenario ?? defaultSteps()),
    useCaseStore: useCaseStore(usecaseValue)
  };
}

function actorStore(): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: (_projectId, actorId) =>
      Promise.resolve(actorId === "actor-1" ? actor() : undefined),
    findActorByName: () => Promise.resolve(undefined),
    listActors: () => Promise.resolve([actor()]),
    saveActor: () => Promise.resolve()
  };
}

function membershipStore(value: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(value ?? undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function revisionStore(readEntityIds: string[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: (entityId) => {
      readEntityIds.push(entityId);
      return Promise.resolve([revision()]);
    },
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function scenarioStore(): ScenarioStore {
  return {
    findMainScenario: () => Promise.resolve(mainScenario()),
    findScenarioById: () => Promise.resolve(undefined),
    listScenarios: () =>
      Promise.resolve([
        mainScenario(),
        extension("scenario-1b", "1b", "Address is incomplete."),
        extension("scenario-any", "*a", "Network is unavailable."),
        extension("scenario-1a", "1a", "Payment is declined.")
      ]),
    saveScenario: () => Promise.resolve()
  };
}

function stakeholderInterestStore(): StakeholderInterestStore {
  return {
    listStakeholderInterests: () => Promise.resolve([stakeholderInterest()]),
    saveStakeholderInterest: () => Promise.resolve()
  };
}

function stakeholderStore(): StakeholderStore {
  return {
    archiveStakeholder: () => Promise.resolve(false),
    findStakeholderById: () => Promise.resolve(stakeholder()),
    findStakeholderByName: () => Promise.resolve(undefined),
    listStakeholders: () => Promise.resolve([stakeholder()]),
    saveStakeholder: () => Promise.resolve()
  };
}

function stepStore(stepsByScenario: Map<string, StoredStep[]>): StepStore {
  return {
    findStepById: () => Promise.resolve(undefined),
    listSteps: (scenarioId) => Promise.resolve(stepsByScenario.get(scenarioId) ?? []),
    saveStep: () => Promise.resolve(),
    updateStep: () => Promise.resolve()
  };
}

function useCaseStore(value: StoredUseCase | null): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(value === null ? undefined : { projectId: value.project_id, usecase: value }),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
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

function extension(id: string, extensionPoint: string, condition: string): StoredScenario {
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

function step(scenarioId: string, stepNumber: number, action: string): StoredStep {
  return {
    action,
    actor_id: "actor-1",
    id: `${scenarioId}-step-${String(stepNumber)}`,
    is_system_step: false,
    notes: null,
    order_index: stepNumber,
    scenario_id: scenarioId,
    step_number: stepNumber
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
    scope: "checkout",
    status: "DRAFT",
    title: "Places an order"
  };
}
