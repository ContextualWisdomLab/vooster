import type { UsecaseShowResponse } from "@vooster/contracts";

export type SpecCheckId =
  | "actors_registered"
  | "cockburn_fidelity"
  | "extension_points_resolved"
  | "scenario_completeness";

export type SpecCheck = {
  detail?: string;
  id: SpecCheckId;
  status: "fail" | "pass";
};

export function runSpecChecks(body: UsecaseShowResponse): SpecCheck[] {
  return [
    actorsRegistered(body),
    scenarioCompleteness(body),
    extensionPointsResolved(body),
    cockburnFidelity(body)
  ];
}

function actorsRegistered(body: UsecaseShowResponse): SpecCheck {
  const declared = declaredActorNames(body);
  const used = uniqueStepActors(body);
  const missing =
    declared.size === 0
      ? used.filter((actor) => actor.trim() === "")
      : used.filter((actor) => !declared.has(actor));
  return missing.length === 0
    ? { id: "actors_registered", status: "pass" }
    : {
        detail: `Unregistered step actors: ${missing.join(", ")}`,
        id: "actors_registered",
        status: "fail"
      };
}

function scenarioCompleteness(body: UsecaseShowResponse): SpecCheck {
  const scenarios = body.scenarios ?? [];
  const issues = [
    ...(!scenarios.some((scenario) => scenario.type === "MAIN_SUCCESS")
      ? ["Missing main success scenario"]
      : []),
    ...emptyScenarioLabels(scenarios).map((label) => `Empty scenario: ${label}`)
  ];
  return issues.length === 0
    ? { id: "scenario_completeness", status: "pass" }
    : { detail: issues.join("; "), id: "scenario_completeness", status: "fail" };
}

function extensionPointsResolved(body: UsecaseShowResponse): SpecCheck {
  const mainSteps = new Set(
    (body.scenarios ?? [])
      .filter((scenario) => scenario.type === "MAIN_SUCCESS")
      .flatMap((scenario) => scenario.steps.map((step) => step.step_number))
  );
  const issues = extensionPointIssues(body.scenarios ?? [], mainSteps);
  return issues.length === 0
    ? { id: "extension_points_resolved", status: "pass" }
    : {
        detail: issues.join("; "),
        id: "extension_points_resolved",
        status: "fail"
      };
}

function cockburnFidelity(body: UsecaseShowResponse): SpecCheck {
  const missing = [
    ...emptyField("title", body.usecase.title),
    ...emptyField("level", body.usecase.level),
    ...emptyField("primary_actor", body.primary_actor?.name)
  ];
  return missing.length === 0
    ? { id: "cockburn_fidelity", status: "pass" }
    : {
        detail: `Missing fields: ${missing.join(", ")}`,
        id: "cockburn_fidelity",
        status: "fail"
      };
}

function declaredActorNames(body: UsecaseShowResponse): Set<string> {
  const actors = (body as { actors?: Array<{ name?: unknown }> }).actors ?? [];
  return new Set(
    actors
      .map((actor) => actor.name)
      .filter((name): name is string => typeof name === "string" && name.trim() !== "")
  );
}

function uniqueStepActors(body: UsecaseShowResponse): string[] {
  return Array.from(
    new Set(
      (body.scenarios ?? []).flatMap((scenario) =>
        scenario.steps.map((step) => step.actor)
      )
    )
  ).sort();
}

function emptyScenarioLabels(scenarios: NonNullable<UsecaseShowResponse["scenarios"]>) {
  return scenarios
    .filter((scenario) => scenario.steps.length === 0)
    .map((scenario) => scenarioLabel(scenario));
}

function extensionPointIssues(
  scenarios: NonNullable<UsecaseShowResponse["scenarios"]>,
  mainSteps: Set<number>
): string[] {
  const seen = new Set<string>();
  return scenarios
    .filter((scenario) => scenario.type !== "MAIN_SUCCESS")
    .flatMap((scenario) => extensionScenarioIssues(scenario, mainSteps, seen));
}

function extensionScenarioIssues(
  scenario: NonNullable<UsecaseShowResponse["scenarios"]>[number],
  mainSteps: Set<number>,
  seen: Set<string>
): string[] {
  const point = scenario.extension_point ?? "";
  if (point.trim() === "") {
    return [`${scenarioLabel(scenario)} has no extension point`];
  }
  const duplicate = seen.has(point) ? [`Duplicate extension point ${point}`] : [];
  seen.add(point);
  return [...duplicate, ...parentStepIssues(point, mainSteps)];
}

function parentStepIssues(point: string, mainSteps: Set<number>): string[] {
  const match = /^(?<step>\d+)[a-z]$/.exec(point);
  if (match?.groups?.step === undefined) {
    return point.startsWith("*") ? [] : [`Malformed extension point ${point}`];
  }
  const parent = Number.parseInt(match.groups.step, 10);
  return mainSteps.has(parent)
    ? []
    : [`Extension ${point} points to missing main step ${String(parent)}`];
}

function scenarioLabel(
  scenario: NonNullable<UsecaseShowResponse["scenarios"]>[number]
): string {
  return scenario.extension_point ?? scenario.type;
}

function emptyField(name: string, value: string | undefined): string[] {
  return value === undefined || value.trim() === "" ? [name] : [];
}
