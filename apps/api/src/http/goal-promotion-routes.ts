import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { goalParamsSchema, goalPromoteRequestSchema } from "@vooster/contracts";
import { promoteGoal as promoteGoalApplication } from "../application/goal-promotion.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import { sendGoalPromotionResult } from "./goal-promotion-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

export function registerGoalPromotionRoutes(
  app: FastifyInstance,
  state: SignupState,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/goals/:goalId/promote", (request, reply) =>
    promoteGoal(
      request,
      reply,
      state,
      goalStore,
      membershipStore,
      projectStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function promoteGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = goalPromoteRequestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid promotion request"));
  }
  const result = await promoteGoalApplication(
    { goalStore, membershipStore, projectStore, revisionStore, useCaseStore },
    {
      goalId: goalIdFrom(request.params),
      simulateUseCaseInsertFailure:
        parsed.data.simulate_usecase_insert_failure === true,
      userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
    }
  );
  return sendGoalPromotionResult(reply, result);
}

function goalIdFrom(params: unknown): string {
  return goalParamsSchema.parse(params).goalId;
}
