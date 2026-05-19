import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createExtensionScenario } from "./scenario-extension-support.js";
import {
  appendUseCaseRevision,
  duplicateMainSuccessProblem,
  mainSuccessScenario,
  passiveActionProblem,
  scenarioWithUseCase,
  stepCreateResponse,
  unknownStepActorProblem,
  usesPassiveVoice
} from "./scenario-support.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredScenario,
  StoredStep
} from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

const scenarioRequestSchema = z.object({
  condition: z.string().optional(),
  extension_point: z.string().optional(),
  outcome: z.enum(["FAILURE", "PARTIAL", "SUCCESS"]).optional(),
  type: z.enum(["EXTENSION", "MAIN_SUCCESS"])
});
const stepRequestSchema = z.object({
  action: z.string(),
  actor: z.string().min(1),
  force: z.boolean().default(false)
});

export function registerScenarioRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore
) {
  app.post("/v1/usecases/:usecaseId/scenarios", (request, reply) =>
    createScenario(request, reply, state, membershipStore)
  );
  app.post("/v1/scenarios/:scenarioId/steps", (request, reply) =>
    addStep(request, reply, state, actorStore, membershipStore)
  );
}

async function createScenario(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore
) {
  const found = useCaseWithProjectId(state, usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = scenarioRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid scenario request"));
  }
  if (parsed.data.type === "EXTENSION") {
    return createExtensionScenario(reply, state, found, {
      ...parsed.data,
      type: "EXTENSION"
    });
  }
  const existing = mainSuccessScenario(state, found.usecase.id);
  if (existing !== undefined) {
    return reply.code(409).send(duplicateMainSuccessProblem(existing));
  }
  if ((state.stakeholderInterestsByUseCaseId.get(found.usecase.id) ?? []).length === 0) {
    return reply
      .code(422)
      .send(problem(422, "Use case needs at least one stakeholder interest"));
  }

  const scenario: StoredScenario = {
    id: randomUUID(),
    usecase_id: found.usecase.id,
    type: parsed.data.type,
    extension_point: null,
    parent_step_number: null,
    condition: null,
    outcome: "SUCCESS",
    order_index: 0
  };
  state.scenariosByUseCaseId.set(found.usecase.id, [
    ...(state.scenariosByUseCaseId.get(found.usecase.id) ?? []),
    scenario
  ]);
  const revision = appendUseCaseRevision(
    state,
    found.usecase,
    `Created main success scenario ${scenario.id}`
  );

  return reply.code(201).send({ scenario, revision, steps: [] });
}

async function addStep(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore
) {
  const found = scenarioWithUseCase(state, scenarioIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Scenario not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = stepRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid step request"));
  }
  if (parsed.data.action.trim().length === 0) {
    return reply.code(400).send(problem(400, "Step action is required"));
  }
  if (!parsed.data.force && usesPassiveVoice(parsed.data.action)) {
    return reply.code(422).send(passiveActionProblem(parsed.data.action));
  }
  const actor = await actorStore.findActorByName(found.projectId, parsed.data.actor);
  if (actor === undefined || actor.archived_at !== null) {
    const knownActors = (await actorStore.listActors(found.projectId))
      .filter((candidate) => candidate.archived_at === null)
      .map((candidate) => candidate.name);
    return reply.code(422).send(unknownStepActorProblem(knownActors));
  }

  const steps = state.stepsByScenarioId.get(found.scenario.id) ?? [];
  const step: StoredStep = {
    id: randomUUID(),
    scenario_id: found.scenario.id,
    step_number: steps.length + 1,
    actor_id: actor.id,
    action: parsed.data.action,
    is_system_step: actor.name === "System",
    notes: null,
    order_index: steps.length
  };
  const scenarioSteps = [...steps, step];
  state.stepsByScenarioId.set(found.scenario.id, scenarioSteps);
  const revision = appendUseCaseRevision(
    state,
    found.usecase,
    `Added step ${String(step.step_number)} to main success scenario`
  );

  return reply.code(201).send(stepCreateResponse(step, revision, scenarioSteps));
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}

function scenarioIdFrom(params: unknown): string {
  return z.object({ scenarioId: z.string().min(1) }).parse(params).scenarioId;
}
