import type { StoredUseCase } from "../domain/entities/index.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type DoctorCheck = {
  id: string;
  message: string;
  status: "fail" | "pass" | "warning";
};

export type DoctorResult =
  | { status: "PROJECT_NOT_FOUND" }
  | { status: "USECASE_NOT_FOUND" }
  | {
      checks: DoctorCheck[];
      scope: {
        project_id: string;
        usecase?: {
          id: string;
          key: string;
          title: string;
        };
      };
      status: "issues_found" | "ok";
      suggested_next_actions: Array<{ command: string; reason: string }>;
    };

export type DoctorDeps = {
  projectStore: ProjectStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
};

export async function diagnoseProject(
  deps: Pick<DoctorDeps, "projectStore" | "useCaseStore">,
  projectId: string
): Promise<DoctorResult> {
  const project = await deps.projectStore.findProjectById(projectId);
  if (project === undefined) {
    return { status: "PROJECT_NOT_FOUND" };
  }

  const usecases = await deps.useCaseStore.listUseCases(projectId);
  const checks: DoctorCheck[] = [
    {
      id: "project.exists",
      message: `Project ${project.key} is available.`,
      status: "pass"
    },
    {
      id: "project.usecases.visible",
      message: `${String(usecases.length)} use case(s) visible in this project.`,
      status: "pass"
    }
  ];

  return {
    checks,
    scope: { project_id: projectId },
    status: "ok",
    suggested_next_actions: [
      {
        command: "vspec usecase list",
        reason: "Choose a use case for deeper quality checks."
      }
    ]
  };
}

export async function diagnoseUseCase(
  deps: DoctorDeps,
  usecaseIdOrKey: string
): Promise<DoctorResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(usecaseIdOrKey);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }

  const interests = await deps.stakeholderInterestStore.listStakeholderInterests(
    found.usecase.id
  );
  const mainScenario = await deps.scenarioStore.findMainScenario(found.usecase.id);
  const mainSteps =
    mainScenario === undefined ? [] : await deps.stepStore.listSteps(mainScenario.id);
  const checks = useCaseChecks(
    found.usecase,
    interests.length,
    mainScenario !== undefined,
    mainSteps.length
  );
  const suggested_next_actions = nextActions(found.usecase, checks);

  return {
    checks,
    scope: {
      project_id: found.projectId,
      usecase: {
        id: found.usecase.id,
        key: found.usecase.key,
        title: found.usecase.title
      }
    },
    status: checks.some((check) => check.status !== "pass") ? "issues_found" : "ok",
    suggested_next_actions
  };
}

function useCaseChecks(
  usecase: StoredUseCase,
  interestCount: number,
  hasMainScenario: boolean,
  mainStepCount: number
): DoctorCheck[] {
  return [
    {
      id: "usecase.exists",
      message: `Use case ${usecase.key} is available.`,
      status: "pass"
    },
    {
      id: "stakeholder_interests.present",
      message:
        interestCount === 0
          ? "No stakeholder interests are recorded."
          : `${String(interestCount)} stakeholder interest(s) recorded.`,
      status: interestCount === 0 ? "fail" : "pass"
    },
    {
      id: "main_success.present",
      message: hasMainScenario
        ? "Main success scenario is present."
        : "Main success scenario is missing.",
      status: hasMainScenario ? "pass" : "fail"
    },
    {
      id: "main_success.steps",
      message:
        mainStepCount === 0
          ? "Main success scenario has no steps."
          : `Main success scenario has ${String(mainStepCount)} step(s).`,
      status: mainStepCount === 0 ? "warning" : "pass"
    }
  ];
}

function nextActions(usecase: StoredUseCase, checks: DoctorCheck[]) {
  const actions: Array<{ command: string; reason: string }> = [];
  if (hasCheck(checks, "stakeholder_interests.present")) {
    actions.push({
      command: `vspec stakeholder interest add ${usecase.key}`,
      reason: "Add at least one Cockburn stakeholder interest."
    });
  }
  if (hasCheck(checks, "main_success.present")) {
    actions.push({
      command: `vspec scenario add ${usecase.key} --type main-success`,
      reason: "Add the main success scenario before export."
    });
  }
  if (hasCheck(checks, "main_success.steps")) {
    actions.push({
      command: `vspec step add ${usecase.key}`,
      reason: "Add steps to the main success scenario."
    });
  }
  return actions;
}

function hasCheck(checks: DoctorCheck[], id: string): boolean {
  return checks.some((check) => check.id === id && check.status !== "pass");
}
