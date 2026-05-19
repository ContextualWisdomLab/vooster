import type { FastifyReply, FastifyRequest } from "fastify";
import { goalWithProjectId } from "./goal-support.js";
import { promoteGoalToUseCase } from "./goal-promotion-routes.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

export function createUseCaseFromGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  projectId: string
) {
  const fromGoalId = fromGoalIdFrom(request.body);
  if (fromGoalId === undefined) {
    return undefined;
  }

  const found = goalWithProjectId(state, fromGoalId);
  if (found === undefined || found.projectId !== projectId) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }

  return promoteGoalToUseCase(reply, state, found);
}

function fromGoalIdFrom(body: unknown): string | undefined {
  return typeof body === "object" &&
    body !== null &&
    "from_goal_id" in body &&
    typeof body.from_goal_id === "string" &&
    body.from_goal_id.length > 0
    ? body.from_goal_id
    : undefined;
}
