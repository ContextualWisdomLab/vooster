import type { StoredStep, StoredUseCase } from "../domain/entities/index.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import { invocationGraph, type InvocationGraph } from "./usecase-invocations.js";

export type DoctorCheck = {
  id: string;
  message: string;
  status: "fail" | "pass" | "warning";
};

export type DoctorResult =
  | { status: "project_not_found" }
  | { status: "usecase_not_found" }
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

type DoctorSuccessResult = Exclude<
  DoctorResult,
  { status: "project_not_found" } | { status: "usecase_not_found" }
>;

type UseCaseDiagnostic = {
  result: DoctorSuccessResult;
  usecase: StoredUseCase;
};

export async function diagnoseProject(
  deps: DoctorDeps,
  projectId: string
): Promise<DoctorResult> {
  const project = await deps.projectStore.findProjectById(projectId);
  if (project === undefined) {
    return { status: "project_not_found" };
  }

  const visibleUsecases = (await deps.useCaseStore.listUseCases(projectId)).filter(
    (usecase) => usecase.archived_at === null
  );
  const usecaseDiagnostics = await Promise.all(
    visibleUsecases.map(async (usecase) => ({
      result: await diagnoseStoredUseCase(deps, projectId, usecase),
      usecase
    }))
  );
  const failingUsecases = usecaseDiagnostics.filter(
    ({ result }) => result.status !== "ok"
  );
  const checks: DoctorCheck[] = [
    {
      id: "project.exists",
      message: `Project ${project.key} is available.`,
      status: "pass"
    },
    {
      id: "project.usecases.visible",
      message: `${String(visibleUsecases.length)} use case(s) visible in this project.`,
      status: "pass"
    },
    projectUsecaseVerifyCheck(visibleUsecases.length, failingUsecases)
  ];

  return {
    checks,
    scope: { project_id: projectId },
    status: statusFor(checks),
    suggested_next_actions: projectNextActions(failingUsecases)
  };
}

export async function diagnoseUseCase(
  deps: DoctorDeps,
  usecaseIdOrKey: string
): Promise<DoctorResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(usecaseIdOrKey);
  if (found === undefined) {
    return { status: "usecase_not_found" };
  }

  return diagnoseStoredUseCase(deps, found.projectId, found.usecase);
}

async function diagnoseStoredUseCase(
  deps: DoctorDeps,
  projectId: string,
  usecase: StoredUseCase
): Promise<DoctorSuccessResult> {
  const interests = await deps.stakeholderInterestStore.listStakeholderInterests(
    usecase.id
  );
  const mainScenario = await deps.scenarioStore.findMainScenario(usecase.id);
  const mainSteps =
    mainScenario === undefined ? [] : await deps.stepStore.listSteps(mainScenario.id);
  const listedSteps = await stepsForUseCase(deps, usecase.id);
  const implementationSteps = uniqueSteps(mainSteps.concat(listedSteps));
  const checks = useCaseChecks(
    usecase,
    interests.length,
    mainScenario !== undefined,
    mainSteps.length
  )
    .concat(implementationChecks(usecase, implementationSteps))
    .concat(await invocationChecks(deps, projectId, usecase));
  const suggested_next_actions = nextActions(usecase, checks);

  return {
    checks,
    scope: {
      project_id: projectId,
      usecase: {
        id: usecase.id,
        key: usecase.key,
        title: usecase.title
      }
    },
    status: statusFor(checks),
    suggested_next_actions
  };
}

function projectUsecaseVerifyCheck(
  visibleUsecaseCount: number,
  failingUsecases: UseCaseDiagnostic[]
): DoctorCheck {
  if (failingUsecases.length === 0) {
    return {
      id: "project.usecases.verify",
      message:
        visibleUsecaseCount === 0
          ? "No visible use cases to verify."
          : "All visible use case quality checks pass.",
      status: "pass"
    };
  }

  return {
    id: "project.usecases.verify",
    message: `${String(failingUsecases.length)} visible use case(s) have quality issues: ${failingUsecases
      .map(usecaseDiagnosticLabel)
      .join("; ")}.`,
    status: "fail"
  };
}

function usecaseDiagnosticLabel({ result, usecase }: UseCaseDiagnostic): string {
  const checkIds = result.checks
    .filter((check) => check.status !== "pass")
    .map((check) => check.id);
  return `${usecase.key} (${checkIds.join(", ")})`;
}

function projectNextActions(failingUsecases: UseCaseDiagnostic[]) {
  return [
    {
      command: "vspec usecase list",
      reason: "Choose a use case for deeper quality checks."
    },
    ...failingUsecases.map(({ usecase }) => ({
      command: `vspec doctor --usecase ${usecase.key}`,
      reason: "Inspect the failing use case quality checks."
    }))
  ];
}

function statusFor(checks: DoctorCheck[]): "issues_found" | "ok" {
  return checks.some((check) => check.status !== "pass") ? "issues_found" : "ok";
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
      status: mainStepCount === 0 ? "fail" : "pass"
    }
  ];
}

async function stepsForUseCase(
  deps: Pick<DoctorDeps, "scenarioStore" | "stepStore">,
  usecaseId: string
): Promise<StoredStep[]> {
  return (
    await Promise.all(
      (await deps.scenarioStore.listScenarios(usecaseId)).map((scenario) =>
        deps.stepStore.listSteps(scenario.id)
      )
    )
  ).flat();
}

function implementationChecks(
  usecase: StoredUseCase,
  steps: StoredStep[]
): DoctorCheck[] {
  if (usecase.status === "DRAFT") {
    return [];
  }
  const unlinked = steps.filter((step) => step.implements.length === 0);
  return unlinked.length === 0
    ? []
    : [
        {
          id: "steps.unlinked",
          message: `${String(unlinked.length)} step(s) have no implementation link.`,
          status: "warning"
        }
      ];
}

function uniqueSteps(steps: StoredStep[]): StoredStep[] {
  return Array.from(new Map(steps.map((step) => [step.id, step])).values());
}

async function invocationChecks(
  deps: Pick<DoctorDeps, "scenarioStore" | "stepStore" | "useCaseStore">,
  projectId: string,
  usecase: StoredUseCase
): Promise<DoctorCheck[]> {
  const graph = await invocationGraph(deps, projectId);
  const knownKeys = new Set(graph.keys());
  const invokes = (graph.get(usecase.key) ?? []).flatMap((edge) => edge.step.invokes);
  const checks: DoctorCheck[] = [];

  const dangling = invokes.filter((key) => !knownKeys.has(key));
  if (dangling.length > 0) {
    checks.push({
      id: "invokes.target_exists",
      message: `Invocation target(s) not found: ${unique(dangling).join(", ")}.`,
      status: "warning"
    });
  }

  if (invokes.includes(usecase.key)) {
    checks.push({
      id: "invokes.no_self_reference",
      message: `Use case ${usecase.key} invokes itself.`,
      status: "warning"
    });
  }

  if (hasInvocationCycle(graph, usecase.key)) {
    checks.push({
      id: "invokes.acyclic",
      message: `Use case ${usecase.key} participates in an invocation cycle.`,
      status: "warning"
    });
  }

  return checks;
}

function hasInvocationCycle(graph: InvocationGraph, startKey: string): boolean {
  const seen = new Set<string>();

  function visit(key: string): boolean {
    for (const next of (graph.get(key) ?? []).flatMap((edge) => edge.step.invokes)) {
      if (next === startKey) {
        return true;
      }
      if (!graph.has(next) || seen.has(next)) {
        continue;
      }
      seen.add(next);
      if (visit(next)) {
        return true;
      }
    }
    return false;
  }

  return visit(startKey);
}

function unique(values: string[]) {
  return [...new Set(values)];
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
