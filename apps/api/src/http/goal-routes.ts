import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { goalIdFrom, projectIdFrom } from "./goal-support.js";
import { goalPatchSchema, goalRequestSchema } from "./goal-validation.js";
import {
  createGoal as createGoalUseCase,
  listGoals as listGoalsUseCase,
  patchGoal as patchGoalUseCase,
  type ActorGoalsDeps
} from "../application/actor-goals.js";
import {
  sendCreateGoalResult,
  sendListGoalsResult,
  sendPatchGoalResult
} from "./goal-results.js";
import { showGoal } from "./goal-show-routes.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export function registerGoalRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  workspaceStore: WorkspaceStore
) {
  app.post("/v1/projects/:projectId/goals", (request, reply) =>
    createGoal(request, reply, state, {
      actorStore,
      goalStore,
      membershipStore,
      projectStore,
      revisionStore,
      workspaceStore
    })
  );
  app.get("/v1/projects/:projectId/goals", (request, reply) =>
    listGoals(request, reply, state, {
      actorStore,
      goalStore,
      membershipStore
    })
  );
  app.get("/v1/goals/:goalId", (request, reply) =>
    showGoal(request, reply, state, {
      goalStore,
      membershipStore
    })
  );
  app.patch("/v1/goals/:goalId", (request, reply) =>
    patchGoal(request, reply, state, {
      actorStore,
      goalStore,
      membershipStore,
      projectStore,
      revisionStore,
      workspaceStore
    })
  );
}

async function createGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: ActorGoalsDeps
) {
  const projectId = projectIdFrom(request.params);
  const parsed = goalRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid goal request"));
  }

  if (parsed.data.description.trim().length === 0) {
    return reply.code(400).send(
      problem(400, "Goal description must be a verb phrase", {
        description_rule: "Use a non-empty verb phrase."
      })
    );
  }

  const result = await createGoalUseCase(deps, {
    actorId: parsed.data.actor_id,
    description: parsed.data.description,
    dryRun: dryRunFromQuery(request.query),
    level: parsed.data.level,
    priority: parsed.data.priority,
    projectId,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendCreateGoalResult(reply, result);
}

function dryRunFromQuery(query: unknown): boolean {
  return (
    typeof query === "object" &&
    query !== null &&
    (query as { dry_run?: unknown }).dry_run === "true"
  );
}

async function patchGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: ActorGoalsDeps
) {
  const parsed = goalPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid goal update"));
  }

  const result = await patchGoalUseCase(deps, {
    goalId: goalIdFrom(request.params),
    status: parsed.data.status,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendPatchGoalResult(reply, result);
}

async function listGoals(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: Pick<ActorGoalsDeps, "actorStore" | "goalStore" | "membershipStore">
) {
  const projectId = projectIdFrom(request.params);
  const { actor_id: actorId } = z
    .object({ actor_id: z.string().optional() })
    .parse(request.query);
  const result = await listGoalsUseCase(deps, {
    actorId,
    projectId,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });
  return sendListGoalsResult(reply, result);
}
