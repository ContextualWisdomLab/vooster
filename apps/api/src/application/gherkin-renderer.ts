import type {
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import { orderScenarioStepsForDisplay } from "./scenario-step-ordering.js";

export type GherkinRenderDeps = {
  actorStore: ActorStore;
  scenarioStore: ScenarioStore;
  stepStore: StepStore;
};

export async function renderGherkinFeature(
  deps: GherkinRenderDeps,
  projectId: string,
  usecase: StoredUseCase
) {
  const scenarios = await deps.scenarioStore.listScenarios(usecase.id);
  const main = scenarios.find((scenario) => scenario.type === "MAIN_SUCCESS");
  const extensions = scenarios
    .filter((scenario) => scenario.type === "EXTENSION")
    .sort((left, right) =>
      (left.extension_point ?? "").localeCompare(right.extension_point ?? "")
    );
  return `${[
    `Feature: ${usecase.title}`,
    `Background:\n  Given the use case is in scope ${usecase.scope}`,
    main === undefined ? "" : await renderMainScenario(deps, projectId, main),
    ...(await Promise.all(
      extensions.map((scenario) => renderExtensionScenario(deps, projectId, scenario))
    ))
  ]
    .filter((section) => section.length > 0)
    .join("\n\n")}\n`;
}

export async function gherkinMissingRequiredField(
  scenarioStore: ScenarioStore,
  stepStore: StepStore,
  usecase: StoredUseCase
) {
  const main = await scenarioStore.findMainScenario(usecase.id);
  const stepCount =
    main === undefined ? 0 : (await stepStore.listSteps(main.id)).length;
  if (main !== undefined && stepCount > 0) {
    return undefined;
  }
  return main === undefined ? "main_success" : "main_success.steps";
}

async function renderMainScenario(
  deps: GherkinRenderDeps,
  projectId: string,
  scenario: StoredScenario
) {
  const steps = await Promise.all(
    (await scenarioSteps(deps.stepStore, scenario.id)).map(
      async (step) =>
        `  When ${await actorName(deps.actorStore, projectId, step.actor_id)} ${step.action}`
    )
  );
  return ["Scenario: Main success", ...steps].join("\n");
}

async function renderExtensionScenario(
  deps: GherkinRenderDeps,
  projectId: string,
  scenario: StoredScenario
) {
  const condition = scenario.condition ?? "Extension";
  const extensionPoint = scenario.extension_point ?? "*";
  const parentStep = scenario.parent_step_number ?? 0;
  const steps = await Promise.all(
    (await scenarioSteps(deps.stepStore, scenario.id)).map(
      async (step) =>
        `  When ${await actorName(deps.actorStore, projectId, step.actor_id)} ${step.action}`
    )
  );
  return [
    `Scenario: ${extensionPoint} ${condition}`,
    `  Given main success reaches step ${String(parentStep)}`,
    ...steps,
    `  Then outcome is ${scenario.outcome}`
  ].join("\n");
}

async function scenarioSteps(
  stepStore: StepStore,
  scenarioId: string
): Promise<StoredStep[]> {
  return orderScenarioStepsForDisplay(await stepStore.listSteps(scenarioId));
}

async function actorName(actorStore: ActorStore, projectId: string, actorId: string) {
  return (await actorStore.findActorById(projectId, actorId))?.name ?? "System";
}
