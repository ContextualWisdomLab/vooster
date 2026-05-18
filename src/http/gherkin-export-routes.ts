import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredScenario, StoredStep, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

const paramsSchema = z.object({ id: z.string().min(1) });

export function registerGherkinExportRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/usecases/:id/export/gherkin", (request, reply) =>
    exportGherkin(request, reply, state)
  );
}

function exportGherkin(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const usecaseId = paramsSchema.parse(request.params).id;
  const found = useCaseWithProjectId(state, usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to export Gherkin"));
  }
  const prerequisiteProblem = gherkinPrerequisiteProblem(state, found.usecase);
  if (prerequisiteProblem !== undefined) {
    return reply.code(422).send(prerequisiteProblem);
  }
  return reply.type("text/plain").send(renderFeature(state, found.projectId, found.usecase));
}

function gherkinPrerequisiteProblem(state: SignupState, usecase: StoredUseCase) {
  const main = (state.scenariosByUseCaseId.get(usecase.id) ?? [])
    .find((scenario) => scenario.type === "MAIN_SUCCESS");
  if (main !== undefined && scenarioSteps(state, main.id).length > 0) {
    return undefined;
  }
  return problem(
    422,
    "Cannot export incomplete use case",
    { missing_required_field: main === undefined ? "main_success" : "main_success.steps" },
    [
      {
        command: `vspec doctor ${usecase.key}`,
        reason: "Inspect missing Gherkin export prerequisites."
      },
      {
        command: `vspec scenario add ${usecase.key} --type main-success`,
        reason: "Create the required main success scenario before export."
      }
    ]
  );
}

function renderFeature(state: SignupState, projectId: string, usecase: StoredUseCase) {
  const scenarios = state.scenariosByUseCaseId.get(usecase.id) ?? [];
  const main = scenarios.find((scenario) => scenario.type === "MAIN_SUCCESS");
  const extensions = scenarios
    .filter((scenario) => scenario.type === "EXTENSION")
    .sort((left, right) => (left.extension_point ?? "").localeCompare(right.extension_point ?? ""));
  return [
    `Feature: ${usecase.title}`,
    `Background:\n  Given the use case is in scope ${usecase.scope}`,
    main === undefined ? "" : renderMainScenario(state, projectId, main),
    ...extensions.map((scenario) => renderExtensionScenario(state, projectId, scenario))
  ].filter((section) => section.length > 0).join("\n\n") + "\n";
}

function renderMainScenario(state: SignupState, projectId: string, scenario: StoredScenario) {
  return [
    "Scenario: Main success",
    ...scenarioSteps(state, scenario.id).map((step) =>
      `  When ${actorName(state, projectId, step.actor_id)} ${step.action}`)
  ].join("\n");
}

function renderExtensionScenario(state: SignupState, projectId: string, scenario: StoredScenario) {
  const condition = scenario.condition ?? "Extension";
  const extensionPoint = scenario.extension_point ?? "*";
  const parentStep = scenario.parent_step_number ?? 0;
  return [
    `Scenario: ${extensionPoint} ${condition}`,
    `  Given main success reaches step ${String(parentStep)}`,
    ...scenarioSteps(state, scenario.id).map((step) =>
      `  When ${actorName(state, projectId, step.actor_id)} ${step.action}`),
    `  Then outcome is ${scenario.outcome}`
  ].join("\n");
}

function scenarioSteps(state: SignupState, scenarioId: string): StoredStep[] {
  return [...(state.stepsByScenarioId.get(scenarioId) ?? [])]
    .sort((left, right) => left.step_number - right.step_number);
}

function actorName(state: SignupState, projectId: string, actorId: string) {
  return (state.actorsByProjectId.get(projectId) ?? [])
    .find((actor) => actor.id === actorId)?.name ?? "System";
}
