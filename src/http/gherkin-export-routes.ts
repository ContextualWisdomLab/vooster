import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  archivedUseCaseProblem,
  existingOutputProblem,
  gherkinPrerequisiteProblem,
  missingRevisionProblem,
  outputPathProblem
} from "./gherkin-export-problems.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredScenario, StoredStep, StoredUseCase } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const paramsSchema = z.object({ id: z.string().min(1) });
const exportSchema = z.object({
  existing_file_content: z.string().optional(),
  force: z.boolean().default(false),
  output_path: z.string().optional(),
  revision_id: z.string().optional()
});

export function registerGherkinExportRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stepStore: StepStore
) {
  app.post("/v1/usecases/:id/export/gherkin", (request, reply) =>
    exportGherkin(
      request,
      reply,
      state,
      actorStore,
      membershipStore,
      useCaseStore,
      scenarioStore,
      stepStore
    )
  );
}

async function exportGherkin(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stepStore: StepStore
) {
  const usecaseId = paramsSchema.parse(request.params).id;
  const parsed = exportSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid Gherkin export request"));
  }
  const found = await useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to export Gherkin"));
  }
  const archivedProblem = archivedUseCaseProblem(found.usecase);
  if (archivedProblem !== undefined) {
    return reply.code(409).send(archivedProblem);
  }
  const revisionProblem = missingRevisionProblem(state, found.usecase, parsed.data.revision_id);
  if (revisionProblem !== undefined) {
    return reply.code(404).send(revisionProblem);
  }
  const prerequisiteProblem = await gherkinPrerequisiteProblem(
    state,
    scenarioStore,
    stepStore,
    found.usecase
  );
  if (prerequisiteProblem !== undefined) {
    return reply.code(422).send(prerequisiteProblem);
  }
  const outputProblem = outputPathProblem(parsed.data.output_path);
  if (outputProblem !== undefined) {
    return reply.code(400).send(outputProblem);
  }
  const feature = await renderFeature(
    state,
    found.projectId,
    found.usecase,
    actorStore,
    scenarioStore,
    stepStore
  );
  if (parsed.data.existing_file_content !== undefined && !parsed.data.force) {
    return reply.code(409).send(existingOutputProblem(
      found.usecase,
      parsed.data.output_path,
      parsed.data.existing_file_content,
      feature
    ));
  }
  return reply.type("text/plain").send(feature);
}

async function renderFeature(
  state: SignupState,
  projectId: string,
  usecase: StoredUseCase,
  actorStore: ActorStore,
  scenarioStore: ScenarioStore,
  stepStore: StepStore
) {
  const scenarios = await scenarioStore.listScenarios(usecase.id);
  const main = scenarios.find((scenario) => scenario.type === "MAIN_SUCCESS");
  const extensions = scenarios
    .filter((scenario) => scenario.type === "EXTENSION")
    .sort((left, right) => (left.extension_point ?? "").localeCompare(right.extension_point ?? ""));
  return [
    `Feature: ${usecase.title}`,
    `Background:\n  Given the use case is in scope ${usecase.scope}`,
    main === undefined ? "" : await renderMainScenario(projectId, main, actorStore, stepStore),
    ...(await Promise.all(
      extensions.map((scenario) =>
        renderExtensionScenario(projectId, scenario, actorStore, stepStore)
      )
    ))
  ].filter((section) => section.length > 0).join("\n\n") + "\n";
}

async function renderMainScenario(
  projectId: string,
  scenario: StoredScenario,
  actorStore: ActorStore,
  stepStore: StepStore
) {
  const steps = await Promise.all(
    (await scenarioSteps(stepStore, scenario.id)).map(async (step) =>
      `  When ${await actorName(actorStore, projectId, step.actor_id)} ${step.action}`)
  );
  return [
    "Scenario: Main success",
    ...steps
  ].join("\n");
}

async function renderExtensionScenario(
  projectId: string,
  scenario: StoredScenario,
  actorStore: ActorStore,
  stepStore: StepStore
) {
  const condition = scenario.condition ?? "Extension";
  const extensionPoint = scenario.extension_point ?? "*";
  const parentStep = scenario.parent_step_number ?? 0;
  const steps = await Promise.all(
    (await scenarioSteps(stepStore, scenario.id)).map(async (step) =>
      `  When ${await actorName(actorStore, projectId, step.actor_id)} ${step.action}`)
  );
  return [
    `Scenario: ${extensionPoint} ${condition}`,
    `  Given main success reaches step ${String(parentStep)}`,
    ...steps,
    `  Then outcome is ${scenario.outcome}`
  ].join("\n");
}

async function scenarioSteps(stepStore: StepStore, scenarioId: string): Promise<StoredStep[]> {
  return [...(await stepStore.listSteps(scenarioId))]
    .sort((left, right) => left.step_number - right.step_number);
}

async function actorName(actorStore: ActorStore, projectId: string, actorId: string) {
  return (await actorStore.findActorById(projectId, actorId))?.name ?? "System";
}
