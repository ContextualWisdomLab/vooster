import { describe, expect, test } from "vitest";
import { diagnoseProject, diagnoseUseCase } from "../../../src/application/doctor.js";
import type {
  StoredProject,
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
      diagnoseProject(depsFor({ project: null }), "missing-project")
    ).resolves.toEqual({ status: "project_not_found" });
    await expect(
      diagnoseUseCase(depsFor({ usecase: null }), "missing")
    ).resolves.toEqual({
      status: "usecase_not_found"
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
      expect.objectContaining({ id: "main_success.steps", status: "fail" })
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

  test("does not false-flag complete Korean use case prose", async () => {
    const result = await diagnoseUseCase(
      depsFor({
        interests: [interest()],
        mainScenario: scenario(),
        steps: [step({ action: "고객이 주문을 제출한다." })],
        usecase: {
          projectId: "project-1",
          usecase: usecase({ title: "주문을 생성한다" })
        }
      }),
      "PAY-001"
    );

    expect(result).toMatchObject({ status: "ok", suggested_next_actions: [] });
  });

  test("warns on dangling, self, and cyclic invocation links", async () => {
    const target = usecase({ id: "usecase-1", key: "PAY-001" });
    const child = usecase({ id: "usecase-2", key: "PAY-002" });
    const result = await diagnoseUseCase(
      depsFor({
        interests: [interest()],
        scenariosByUseCase: new Map([
          [target.id, [scenario({ id: "scenario-1", usecase_id: target.id })]],
          [child.id, [scenario({ id: "scenario-2", usecase_id: child.id })]]
        ]),
        stepsByScenario: new Map([
          [
            "scenario-1",
            [
              step({
                invokes: ["PAY-999", target.key, child.key],
                scenario_id: "scenario-1"
              })
            ]
          ],
          ["scenario-2", [step({ invokes: [target.key], scenario_id: "scenario-2" })]]
        ]),
        usecase: { projectId: "project-1", usecase: target },
        usecases: [target, child]
      }),
      target.key
    );

    expect(result.status).toBe("issues_found");
    if (result.status !== "issues_found") {
      throw new Error("expected doctor warnings");
    }
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "invokes.target_exists",
          status: "warning"
        }),
        expect.objectContaining({
          id: "invokes.no_self_reference",
          status: "warning"
        }),
        expect.objectContaining({
          id: "invokes.acyclic",
          status: "warning"
        })
      ])
    );
  });

  test("warns when scenario steps have no implementation links", async () => {
    const result = await diagnoseUseCase(
      depsFor({
        interests: [interest()],
        mainScenario: scenario(),
        steps: [step({ implements: [] })],
        usecase: {
          projectId: "project-1",
          usecase: usecase({ status: "IN_REVIEW" })
        }
      }),
      "PAY-001"
    );

    expect(result.status).toBe("issues_found");
    if (result.status !== "issues_found") {
      throw new Error("expected doctor warnings");
    }
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: "steps.unlinked",
        status: "warning"
      })
    );
  });

  test("does not warn about unlinked steps for draft use cases", async () => {
    const result = await diagnoseUseCase(
      depsFor({
        interests: [interest()],
        mainScenario: scenario(),
        steps: [step({ implements: [] })]
      }),
      "PAY-001"
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.checks).not.toContainEqual(
        expect.objectContaining({ id: "steps.unlinked" })
      );
    }
  });
});

type DoctorOptions = {
  interests?: StoredStakeholderInterest[];
  mainScenario?: StoredScenario;
  project?: StoredProject | null;
  scenariosByUseCase?: Map<string, StoredScenario[]>;
  steps?: StoredStep[];
  stepsByScenario?: Map<string, StoredStep[]>;
  usecase?: { projectId: string; usecase: StoredUseCase } | null;
  usecases?: StoredUseCase[];
};

function depsFor(options: DoctorOptions = {}) {
  return {
    projectStore: projectStore(
      options.project === null ? undefined : (options.project ?? project())
    ),
    scenarioStore: scenarioStore(options.mainScenario, options.scenariosByUseCase),
    stakeholderInterestStore: stakeholderInterestStore(options.interests ?? []),
    stepStore: stepStore(options.steps ?? [], options.stepsByScenario),
    useCaseStore: useCaseStore(
      options.usecase === null
        ? undefined
        : (options.usecase ?? { projectId: "project-1", usecase: usecase() }),
      options.usecases
    )
  };
}

function projectStore(found: StoredProject | undefined): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(found)
  } as unknown as ProjectStore;
}

function scenarioStore(
  found: StoredScenario | undefined,
  scenariosByUseCase?: Map<string, StoredScenario[]>
): ScenarioStore {
  return {
    findMainScenario: (usecaseId: string) =>
      Promise.resolve(found ?? scenariosByUseCase?.get(usecaseId)?.[0]),
    listScenarios: (usecaseId: string) =>
      Promise.resolve(scenariosByUseCase?.get(usecaseId) ?? [])
  } as unknown as ScenarioStore;
}

function stakeholderInterestStore(
  interests: StoredStakeholderInterest[]
): StakeholderInterestStore {
  return {
    listStakeholderInterests: () => Promise.resolve(interests)
  } as unknown as StakeholderInterestStore;
}

function stepStore(
  steps: StoredStep[],
  stepsByScenario?: Map<string, StoredStep[]>
): StepStore {
  return {
    listSteps: (scenarioId: string) =>
      Promise.resolve(stepsByScenario?.get(scenarioId) ?? steps)
  } as unknown as StepStore;
}

function useCaseStore(
  found: { projectId: string; usecase: StoredUseCase } | undefined,
  usecases?: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseWithProject: () => Promise.resolve(found),
    listUseCases: () =>
      Promise.resolve(usecases ?? (found === undefined ? [] : [found.usecase]))
  } as unknown as UseCaseStore;
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
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
    title: "Pay an invoice",
    ...overrides
  };
}

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-1",
    id: "project-1",
    key: "payments",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
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

function scenario(overrides: Partial<StoredScenario> = {}): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-1",
    order_index: 1,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Pays the invoice.",
    actor_id: "actor-1",
    id: "step-1",
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 1,
    scenario_id: "scenario-1",
    step_number: 1,
    ...overrides,
    implements: overrides.implements ?? ["tests/PAY-001.feature:happy_path"]
  };
}
