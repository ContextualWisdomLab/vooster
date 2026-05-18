import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import {
  appendUseCaseRevision,
  extensionPointParentStep,
  mainScenarioHasStep,
  mainSuccessScenario
} from "./scenario-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredScenario, StoredUseCase } from "./signup-types.js";

export function createExtensionScenario(
  reply: FastifyReply,
  state: SignupState,
  found: { projectId: string; usecase: StoredUseCase },
  data: {
    condition?: string;
    extension_point?: string;
    outcome?: "FAILURE" | "PARTIAL" | "SUCCESS";
    type: "EXTENSION";
  }
) {
  if (data.extension_point === undefined || data.condition === undefined) {
    return reply.code(400).send(problem(400, "Invalid extension scenario request"));
  }
  const parentStepNumber = extensionPointParentStep(data.extension_point);
  const mainScenario = mainSuccessScenario(state, found.usecase.id);
  if (
    mainScenario === undefined ||
    (parentStepNumber !== null &&
      !mainScenarioHasStep(state, mainScenario, parentStepNumber))
  ) {
    return reply.code(422).send(problem(422, "Extension parent step is not available"));
  }

  const scenario: StoredScenario = {
    id: randomUUID(),
    usecase_id: found.usecase.id,
    type: "EXTENSION",
    extension_point: data.extension_point,
    parent_step_number: parentStepNumber,
    condition: data.condition,
    outcome: data.outcome ?? "FAILURE",
    order_index: (state.scenariosByUseCaseId.get(found.usecase.id) ?? []).length
  };
  state.scenariosByUseCaseId.set(found.usecase.id, [
    ...(state.scenariosByUseCaseId.get(found.usecase.id) ?? []),
    scenario
  ]);
  const revision = appendUseCaseRevision(
    state,
    found.usecase,
    `Created extension scenario ${scenario.id}`
  );

  return reply.code(201).send({ scenario, revision, steps: [] });
}
