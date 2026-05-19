import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  allowedStatusTransitions,
  canTransition,
  goalCreateResponse,
  goalIdFrom,
  goalRevision,
  nearDuplicateGoal,
  projectIdFrom
} from "./goal-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredGoal
} from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
const goalRequestSchema = z.object({
  actor_id: z.string().min(1),
  description: z.string(),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]),
  priority: z.enum(["P0", "P1", "P2", "P3"])
});
const goalPatchSchema = z.object({
  status: z.enum(["IDENTIFIED", "IN_DESIGN", "PROMOTED", "REJECTED"]).optional()
});
export function registerGoalRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore
) {
  app.post("/v1/projects/:projectId/goals", (request, reply) =>
    createGoal(request, reply, state, actorStore, goalStore, membershipStore)
  );
  app.get("/v1/projects/:projectId/goals", (request, reply) =>
    listGoals(request, reply, state, actorStore, goalStore, membershipStore)
  );
  app.patch("/v1/goals/:goalId", (request, reply) =>
    patchGoal(request, reply, state, goalStore, membershipStore)
  );
}

async function createGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore
) {
  const projectId = projectIdFrom(request.params);
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

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
  if (projectWorkspaceArchived(state, projectId)) {
    return reply.code(409).send(problem(409, "Workspace has been archived"));
  }

  const actor = await actorStore.findActorById(projectId, parsed.data.actor_id);
  if (actor === undefined || actor.archived_at !== null) {
    return reply.code(422).send(
      problem(
        422,
        "Actor is not available",
        { actor_id: parsed.data.actor_id },
        [
          { command: "vspec actor list", reason: "Find a valid actor for this project." },
          {
            command: "vspec actor create",
            reason: "Create the actor before assigning goals."
          }
        ]
      )
    );
  }

  const goal: StoredGoal = {
    id: randomUUID(),
    project_id: projectId,
    actor_id: actor.id,
    description: parsed.data.description,
    level: parsed.data.level,
    status: "IDENTIFIED",
    linked_usecase_id: null,
    priority: parsed.data.priority,
    archived_at: null
  };
  const duplicateGoal = nearDuplicateGoal(
    await goalStore.listGoals(projectId),
    actor.id,
    goal.description
  );
  const revision = goalRevision(goal, 1);

  await goalStore.saveGoal(goal);
  state.revisionsByEntityId.set(goal.id, [revision]);

  return reply.code(201).send(goalCreateResponse(goal, revision, duplicateGoal));
}

async function patchGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  goalStore: GoalStore,
  membershipStore: MembershipStore
) {
  const goal = await goalStore.findGoalById(goalIdFrom(request.params));
  if (goal === undefined) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }
  if (await membershipForProject(request, state, membershipStore, goal.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (projectWorkspaceArchived(state, goal.project_id)) {
    return reply.code(409).send(problem(409, "Workspace has been archived"));
  }

  const parsed = goalPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid goal update"));
  }

  if (
    parsed.data.status !== undefined &&
    !canTransition(goal.status, parsed.data.status)
  ) {
    return reply.code(422).send(
      problem(422, "Illegal status transition", {
        allowed_status_transitions: allowedStatusTransitions
      })
    );
  }

  if (goal.status === "PROMOTED" && parsed.data.status === "REJECTED") {
    return reply.code(422).send(
      problem(422, "Use case must be archived before rejecting this goal", {}, [
        {
          command: "vspec usecase archive",
          reason: "Deprecate the linked use case before rejecting the goal."
        }
      ])
    );
  }

  if (parsed.data.status !== undefined) {
    goal.status = parsed.data.status;
  }
  const revision = goalRevision(
    goal,
    (state.revisionsByEntityId.get(goal.id) ?? []).length + 1
  );
  state.revisionsByEntityId.set(goal.id, [
    ...(state.revisionsByEntityId.get(goal.id) ?? []),
    revision
  ]);
  await goalStore.updateGoal(goal);

  return reply.send({ goal, revision });
}

async function listGoals(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore
) {
  const projectId = projectIdFrom(request.params);
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const { actor_id: actorId } = z
    .object({ actor_id: z.string().optional() })
    .parse(request.query);
  const actors = (await actorStore.listActors(projectId)).filter(
    (actor) =>
      actor.archived_at === null && (actorId === undefined || actor.id === actorId)
  );
  const goals = await goalStore.listGoals(projectId);

  return reply.send({
    actors: actors.map((actor) => ({
      actor,
      goals: goals.filter((goal) => goal.actor_id === actor.id)
    }))
  });
}

async function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  projectId: string
) {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined) {
    return undefined;
  }

  return membershipStore.membershipForProject(projectId, userId);
}

function projectWorkspaceArchived(state: SignupState, projectId: string): boolean {
  const project = state.projectsById.get(projectId);
  return project !== undefined && state.workspaceArchivedAt.has(project.workspace_id);
}
