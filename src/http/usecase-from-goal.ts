import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { goalWithProjectId } from "./goal-support.js";
import { promoteGoalToUseCase } from "./goal-promotion-routes.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

const useCaseFromGoalRequestSchema = z.object({
  from_goal_id: z.string().min(1)
});

export function createUseCaseFromGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  projectId: string
) {
  const fromGoal = useCaseFromGoalRequestSchema.safeParse(request.body);
  if (!fromGoal.success) {
    return undefined;
  }

  const found = goalWithProjectId(state, fromGoal.data.from_goal_id);
  if (found === undefined || found.projectId !== projectId) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }

  return promoteGoalToUseCase(reply, state, found);
}
