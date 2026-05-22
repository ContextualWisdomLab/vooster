import type { FastifyReply, FastifyRequest } from "fastify";

import { goalIdFrom } from "./goal-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

export async function showGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: {
    goalStore: GoalStore;
    membershipStore: MembershipStore;
  }
) {
  const goal = await deps.goalStore.findGoalById(goalIdFrom(request.params));
  if (goal === undefined) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (
    userId === undefined ||
    (await deps.membershipStore.membershipForProject(goal.project_id, userId)) === undefined
  ) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  return reply.send({
    goal,
    recommended_next_command: "vspec goal list"
  });
}
