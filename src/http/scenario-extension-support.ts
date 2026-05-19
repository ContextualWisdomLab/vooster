import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import {
  appendUseCaseRevision,
  extensionPointParentStep,
  mainScenarioHasStep,
  mainSuccessScenario
} from "./scenario-support.js";
import { problem } from "./signup-support.js";
import type { StoredScenario, StoredUseCase } from "./signup-types.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";

export async function createExtensionScenario(
  reply: FastifyReply,
  revisionStore: RevisionStore,
  scenarioStore: ScenarioStore,
  stepStore: StepStore,
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
  if (!validExtensionPoint(data.extension_point)) {
    return reply.code(400).send(
      problem(400, "Invalid extension point", {
        example_extension_points: ["3a", "7c", "*a"],
        valid_extension_point_forms: ["^\\d+[a-z]$", "^\\*[a-z]$"]
      })
    );
  }
  const parentStepNumber = extensionPointParentStep(data.extension_point);
  const mainScenario = await mainSuccessScenario(scenarioStore, found.usecase.id);
  if (
    mainScenario === undefined ||
    (parentStepNumber !== null &&
      !(await mainScenarioHasStep(stepStore, mainScenario, parentStepNumber)))
  ) {
    return reply
      .code(422)
      .send(parentStepOutOfRangeProblem(found.usecase.key, parentStepNumber));
  }
  const existing = await extensionAtPoint(scenarioStore, found.usecase.id, data.extension_point);
  if (existing !== undefined) {
    return reply.code(409).send(
      problem(
        409,
        "Extension point is already taken",
        {
          existing_condition: existing.condition,
          suggested_extension_point: await nextExtensionPoint(
            scenarioStore,
            found.usecase.id,
            data.extension_point
          )
        }
      )
    );
  }

  const scenario: StoredScenario = {
    id: randomUUID(),
    usecase_id: found.usecase.id,
    type: "EXTENSION",
    extension_point: data.extension_point,
    parent_step_number: parentStepNumber,
    condition: data.condition,
    outcome: data.outcome ?? "FAILURE",
    order_index: (await scenarioStore.listScenarios(found.usecase.id)).length
  };
  await scenarioStore.saveScenario(scenario);
  const revision = await appendUseCaseRevision(
    revisionStore,
    found.usecase,
    `Created extension scenario ${scenario.id}`
  );

  return reply.code(201).send({
    scenario,
    revision,
    steps: [],
    ...(data.outcome === undefined
      ? {
          warnings: [
            {
              type: "DEFAULT_EXTENSION_OUTCOME",
              message:
                "Outcome defaulted to FAILURE; confirm it or edit the scenario outcome."
            }
          ]
        }
      : {})
  });
}

function validExtensionPoint(extensionPoint: string): boolean {
  return /^(\d+|\*)[a-z]$/.test(extensionPoint);
}

function parentStepOutOfRangeProblem(usecaseKey: string, parentStepNumber: number | null) {
  return problem(
    422,
    "Extension parent step is out of range",
    { parent_step_number: parentStepNumber },
    [
      {
        command: `vspec usecase show ${usecaseKey}`,
        reason: "Inspect the current main scenario step numbering."
      }
    ]
  );
}

async function extensionAtPoint(
  scenarioStore: ScenarioStore,
  usecaseId: string,
  extensionPoint: string
): Promise<StoredScenario | undefined> {
  return (await scenarioStore.listScenarios(usecaseId)).find(
    (scenario) => scenario.extension_point === extensionPoint
  );
}

async function nextExtensionPoint(
  scenarioStore: ScenarioStore,
  usecaseId: string,
  extensionPoint: string
): Promise<string> {
  const prefix = extensionPoint.slice(0, -1);
  let letterCode = extensionPoint.charCodeAt(extensionPoint.length - 1) + 1;
  let candidate = `${prefix}${String.fromCharCode(letterCode)}`;

  while (await extensionAtPoint(scenarioStore, usecaseId, candidate) !== undefined) {
    letterCode += 1;
    candidate = `${prefix}${String.fromCharCode(letterCode)}`;
  }

  return candidate;
}
