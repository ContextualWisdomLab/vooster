import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { showUseCaseForAgent } from "../application/usecase-agent.js";
import { authenticatedUserId } from "./session-support.js";
import { sendUseCaseAgentResult } from "./usecase-agent-results.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const paramsSchema = z.object({ usecaseId: z.string().min(1) });
const querySchema = z.object({
  format: z.enum(["agent", "human", "json"]).default("human"),
  revision: z.string().optional(),
  session: z.string().optional()
});

export function registerUseCaseAgentRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  stepStore: StepStore
) {
  app.get("/v1/usecases/:usecaseId", (request, reply) =>
    showUseCase(
      request,
      reply,
      state,
      actorStore,
      membershipStore,
      projectStore,
      revisionStore,
      workSessionStore,
      useCaseStore,
      scenarioStore,
      stakeholderInterestStore,
      stakeholderStore,
      stepStore
    )
  );
}

async function showUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  stepStore: StepStore
) {
  const usecaseId = paramsSchema.parse(request.params).usecaseId;
  const query = querySchema.parse(request.query);
  return sendUseCaseAgentResult(
    reply,
    await showUseCaseForAgent(
      {
        actorStore,
        membershipStore,
        projectStore,
        revisionStore,
        scenarioStore,
        stakeholderInterestStore,
        stakeholderStore,
        stepStore,
        useCaseStore,
        workSessionStore
      },
      {
        format: query.format,
        requestId: requestId(request),
        requestedRevision: query.revision,
        sessionId: query.session,
        usecaseId,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function requestId(request: FastifyRequest) {
  const header = request.headers["x-vspec-request-id"];
  return typeof header === "string" ? header : randomUUID();
}
