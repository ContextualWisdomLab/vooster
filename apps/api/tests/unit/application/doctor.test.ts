import { describe, expect, test } from "vitest";
import { diagnoseProject, diagnoseUseCase } from "../../../src/application/doctor.js";
import type {
  StoredScenario,
  StoredStakeholderInterest,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("doctor application", () => {
  test("reports missing project and use case scopes", async () => {
    await expect(
      diagnoseProject(
        {
          projectStore: {
            findProjectById: () => Promise.resolve(undefined)
          } as unknown as ProjectStore,
          useCaseStore: useCaseStore(undefined)
        },
        "missing-project"
      )
    ).resolves.toEqual({ status: "PROJECT_NOT_FOUND" });
    await expect(
      diagnoseUseCase(depsFor({ usecase: null }), "missing")
    ).resolves.toEqual({
      status: "USECASE_NOT_FOUND"
    });
  });

  test("diagnoses incomplete use cases with fix actions", async () => {
    const result = await diagnoseUseCase(depsFor(), "PAY-001");

    expect(result).toMatchObject({
      scope: {
        project_id: "project-1",
        usecase: { id: "usecase-1", key: "PAY-001", title: "Pay an invoice" }
      },
      status: "issues_found"
    });
    if (result.status !== "issues_found") {
      throw new Error("expected doctor issues");
    }
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: "stakeholder_interests.present",
        status: "fail"
      })
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "main_success.steps", status: "warning" })
    );
    expect(result.suggested_next_actions.map((action) => action.command)).toEqual([
      "vspec stakeholder interest add PAY-001",
      "vspec scenario add PAY-001 --type main-success",
      "vspec step add PAY-001"
    ]);
  });

  test("diagnoses complete use cases without fix actions", async () => {
    const result = await diagnoseUseCase(
      depsFor({ interests: [interest()], mainScenario: scenario(), steps: [step()] }),
      "PAY-001"
    );

    expect(result).toMatchObject({ status: "ok", suggested_next_actions: [] });
    if (result.status === "ok") {
      expect(result.checks).toContainEqual(
        expect.objectContaining({ id: "main_success.steps", status: "pass" })
      );
    }
  });
});

type DoctorOptions = {
  interests?: StoredStakeholderInterest[];
  mainScenario?: StoredScenario;
  steps?: StoredStep[];
  usecase?: { projectId: string; usecase: StoredUseCase } | null;
};

function depsFor(options: DoctorOptions = {}) {
  return {
    projectStore: {} as never,
    scenarioStore: scenarioStore(options.mainScenario),
    stakeholderInterestStore: stakeholderInterestStore(options.interests ?? []),
    stepStore: stepStore(options.steps ?? []),
    useCaseStore: useCaseStore(
      options.usecase === null
        ? undefined
        : (options.usecase ?? { projectId: "project-1", usecase: usecase() })
    )
  };
}

function scenarioStore(found: StoredScenario | undefined): ScenarioStore {
  return {
    findMainScenario: () => Promise.resolve(found)
  } as unknown as ScenarioStore;
}

function stakeholderInterestStore(
  interests: StoredStakeholderInterest[]
): StakeholderInterestStore {
  return {
    listStakeholderInterests: () => Promise.resolve(interests)
  } as unknown as StakeholderInterestStore;
}

function stepStore(steps: StoredStep[]): StepStore {
  return {
    listSteps: () => Promise.resolve(steps)
  } as unknown as StepStore;
}

function useCaseStore(
  found: { projectId: string; usecase: StoredUseCase } | undefined
): UseCaseStore {
  return {
    findUseCaseWithProject: () => Promise.resolve(found),
    listUseCases: () => Promise.resolve(found === undefined ? [] : [found.usecase])
  } as unknown as UseCaseStore;
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Payments",
    status: "DRAFT",
    title: "Pay an invoice"
  };
}

function interest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Get a clear payment receipt.",
    protection_mechanism: "Receipt is shown after payment.",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}

function scenario(): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-1",
    order_index: 1,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1"
  };
}

function step(): StoredStep {
  return {
    action: "Pays the invoice.",
    actor_id: "actor-1",
    id: "step-1",
    is_system_step: false,
    notes: null,
    order_index: 1,
    scenario_id: "scenario-1",
    step_number: 1
  };
}
