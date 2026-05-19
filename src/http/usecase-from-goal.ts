import type { FastifyReply, FastifyRequest } from "fastify";
import { promoteGoalToUseCase } from "./goal-promotion-routes.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export async function createUseCaseFromGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  goalStore: GoalStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  projectId: string
): Promise<boolean> {
  const fromGoalId = fromGoalIdFrom(request.body);
  if (fromGoalId === undefined) {
    return false;
  }

  const goal = await goalStore.findGoalById(fromGoalId);
  if (goal === undefined || goal.project_id !== projectId) {
    reply.code(404).send(problem(404, "Goal not found"));
    return true;
  }

  await promoteGoalToUseCase(
    reply,
    state,
    goalStore,
    projectStore,
    revisionStore,
    useCaseStore,
    { goal, projectId }
  );
  return true;
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
