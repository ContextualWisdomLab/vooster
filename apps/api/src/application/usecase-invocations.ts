import type {
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../domain/entities/index.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type InvocationScanDeps = {
  scenarioStore: Pick<ScenarioStore, "listScenarios">;
  stepStore: Pick<StepStore, "listSteps">;
  useCaseStore: Pick<UseCaseStore, "listUseCases">;
};

export type InvokedBy = {
  key: string;
  scenario_id: string;
  step_number: number;
  title: string;
};

export type InvocationGraph = Map<
  string,
  Array<{ scenario: StoredScenario; step: StoredStep; usecase: StoredUseCase }>
>;

export async function invokedBy(
  deps: InvocationScanDeps,
  projectId: string,
  targetKey: string
): Promise<InvokedBy[]> {
  return [...(await invocationGraph(deps, projectId)).values()]
    .flat()
    .filter((edge) => edge.step.invokes.includes(targetKey))
    .map((edge) => ({
      key: edge.usecase.key,
      scenario_id: edge.scenario.id,
      step_number: edge.step.step_number,
      title: edge.usecase.title
    }));
}

export async function invocationGraph(
  deps: InvocationScanDeps,
  projectId: string
): Promise<InvocationGraph> {
  const graph: InvocationGraph = new Map();
  for (const usecase of await deps.useCaseStore.listUseCases(projectId)) {
    graph.set(usecase.key, await invocationEdgesFor(deps, usecase));
  }
  return graph;
}

async function invocationEdgesFor(
  deps: Pick<InvocationScanDeps, "scenarioStore" | "stepStore">,
  usecase: StoredUseCase
) {
  const scenarios = await deps.scenarioStore.listScenarios(usecase.id);
  const edges = await Promise.all(
    scenarios.map(async (scenario) =>
      (await deps.stepStore.listSteps(scenario.id))
        .filter((step) => step.invokes.length > 0)
        .map((step) => ({ scenario, step, usecase }))
    )
  );
  return edges.flat();
}
