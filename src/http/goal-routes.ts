import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  allowedStatusTransitions,
  canTransition,
  goalCreateResponse,
  goalIdFrom,
  goalRevision,
  goalWithProjectId,
  nearDuplicateGoal,
  projectIdFrom
} from "./goal-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredActor,
  StoredGoal,
  StoredMembership
} from "./signup-types.js";
const goalRequestSchema = z.object({
  actor_id: z.string().min(1),
  description: z.string(),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]),
  priority: z.enum(["P0", "P1", "P2", "P3"])
});
const goalPatchSchema = z.object({
  status: z.enum(["IDENTIFIED", "IN_DESIGN", "PROMOTED", "REJECTED"]).optional()
});
export function registerGoalRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/goals", (request, reply) =>
    createGoal(request, reply, state)
  );
  app.get("/v1/projects/:projectId/goals", (request, reply) =>
    listGoals(request, reply, state)
  );
  app.patch("/v1/goals/:goalId", (request, reply) => patchGoal(request, reply, state));
}

function createGoal(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  if (membershipForProject(request, state, projectId) === undefined) {
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

  const actor = activeActorWithId(state, projectId, parsed.data.actor_id);
  if (actor === undefined) {
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
  const duplicateGoal = nearDuplicateGoal(state, projectId, actor.id, goal.description);
  const revision = goalRevision(goal, 1);

  state.goalsByProjectId.set(projectId, [
    ...(state.goalsByProjectId.get(projectId) ?? []),
    goal
  ]);
  state.revisionsByEntityId.set(goal.id, [revision]);

  return reply.code(201).send(goalCreateResponse(goal, revision, duplicateGoal));
}

function patchGoal(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = goalWithProjectId(state, goalIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const parsed = goalPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid goal update"));
  }

  if (
    parsed.data.status !== undefined &&
    !canTransition(found.goal.status, parsed.data.status)
  ) {
    return reply.code(422).send(
      problem(422, "Illegal status transition", {
        allowed_status_transitions: allowedStatusTransitions
      })
    );
  }

  if (found.goal.status === "PROMOTED" && parsed.data.status === "REJECTED") {
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
    found.goal.status = parsed.data.status;
  }
  const revision = goalRevision(
    found.goal,
    (state.revisionsByEntityId.get(found.goal.id) ?? []).length + 1
  );
  state.revisionsByEntityId.set(found.goal.id, [
    ...(state.revisionsByEntityId.get(found.goal.id) ?? []),
    revision
  ]);

  return reply.send({ goal: found.goal, revision });
}

function listGoals(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  if (membershipForProject(request, state, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const { actor_id: actorId } = z
    .object({ actor_id: z.string().optional() })
    .parse(request.query);
  const actors = (state.actorsByProjectId.get(projectId) ?? []).filter(
    (actor) =>
      actor.archived_at === null && (actorId === undefined || actor.id === actorId)
  );
  const goals = state.goalsByProjectId.get(projectId) ?? [];

  return reply.send({
    actors: actors.map((actor) => ({
      actor,
      goals: goals.filter((goal) => goal.actor_id === actor.id)
    }))
  });
}

function activeActorWithId(
  state: SignupState,
  projectId: string,
  actorId: string
): StoredActor | undefined {
  return (state.actorsByProjectId.get(projectId) ?? []).find(
    (actor) => actor.id === actorId && actor.archived_at === null
  );
}

function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (project === undefined || userId === undefined) {
    return undefined;
  }

  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}
