import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  addScenarioStep as addScenarioStepUseCase,
  createScenario as createScenarioUseCase,
  type ScenarioAuthoringDeps
} from "../application/scenario-authoring.js";
import {
  sendAddScenarioStepResult,
  sendCreateScenarioResult
} from "./scenario-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

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
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  revisionStore: RevisionStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stepStore: StepStore,
  useCaseStore: UseCaseStore
) {
  const deps = {
    actorStore,
    membershipStore,
    revisionStore,
    scenarioStore,
    stakeholderInterestStore,
    stepStore,
    useCaseStore
  };
  app.post("/v1/usecases/:usecaseId/scenarios", (request, reply) =>
    createScenario(request, reply, state, deps)
  );
  app.post("/v1/scenarios/:scenarioId/steps", (request, reply) =>
    addStep(request, reply, state, deps)
  );
}

async function createScenario(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: ScenarioAuthoringDeps
) {
  const usecaseId = usecaseIdFrom(request.params);
  const parsed = scenarioRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid scenario request"));
  }

  const result = await createScenarioUseCase(
    deps,
    parsed.data.type === "EXTENSION"
      ? {
          condition: parsed.data.condition,
          dryRun: dryRunFromQuery(request.query),
          extensionPoint: parsed.data.extension_point,
          outcome: parsed.data.outcome,
          type: "EXTENSION",
          usecaseId,
          userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
        }
      : {
          dryRun: dryRunFromQuery(request.query),
          type: "MAIN_SUCCESS",
          usecaseId,
          userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
        }
  );

  return sendCreateScenarioResult(reply, result);
}

async function addStep(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: ScenarioAuthoringDeps
) {
  const scenarioId = scenarioIdFrom(request.params);
  const parsed = stepRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid step request"));
  }
  if (parsed.data.action.trim().length === 0) {
    return reply.code(400).send(problem(400, "Step action is required"));
  }

  const result = await addScenarioStepUseCase(deps, {
    action: parsed.data.action,
    actorName: parsed.data.actor,
    dryRun: dryRunFromQuery(request.query),
    force: parsed.data.force,
    scenarioId,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendAddScenarioStepResult(reply, result);
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}

function scenarioIdFrom(params: unknown): string {
  return z.object({ scenarioId: z.string().min(1) }).parse(params).scenarioId;
}

function dryRunFromQuery(query: unknown): boolean {
  if (typeof query !== "object" || query === null) {
    return false;
  }
  return (query as { dry_run?: unknown }).dry_run === "true";
}
