import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  stakeholderInterestDeleteParamsSchema,
  stakeholderInterestRequestSchema,
  stakeholderInterestUsecaseParamsSchema
} from "@vooster/contracts";
import {
  addStakeholderInterest as addStakeholderInterestUseCase,
  removeStakeholderInterest as removeStakeholderInterestUseCase,
  type StakeholderInterestDeps
} from "../application/stakeholder-interest.js";
import {
  sendAddStakeholderInterestResult,
  sendRemoveStakeholderInterestResult
} from "./stakeholder-interest-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerStakeholderInterestRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/usecases/:usecaseId/stakeholder-interests", (request, reply) =>
    addStakeholderInterest(request, reply, state, {
      membershipStore,
      revisionStore,
      stakeholderInterestStore,
      stakeholderStore,
      useCaseStore
    })
  );
  app.delete(
    "/v1/usecases/:usecaseId/stakeholder-interests/:stakeholderInterestId",
    (request, reply) =>
      removeStakeholderInterest(request, reply, state, {
        membershipStore,
        revisionStore,
        stakeholderInterestStore,
        stakeholderStore,
        useCaseStore
      })
  );
}

async function addStakeholderInterest(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: StakeholderInterestDeps
) {
  const params = stakeholderInterestUsecaseParamsSchema.parse(request.params);
  const parsed = stakeholderInterestRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder interest request"));
  }

  const result = await addStakeholderInterestUseCase(deps, {
    interest: parsed.data.interest,
    protectionMechanism: parsed.data.protection_mechanism,
    stakeholderName: parsed.data.stakeholder,
    usecaseId: params.usecaseId,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendAddStakeholderInterestResult(reply, result);
}

async function removeStakeholderInterest(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: StakeholderInterestDeps
) {
  const params = stakeholderInterestDeleteParamsSchema.parse(request.params);

  const result = await removeStakeholderInterestUseCase(deps, {
    stakeholderInterestId: params.stakeholderInterestId,
    usecaseId: params.usecaseId,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendRemoveStakeholderInterestResult(reply, result);
}
