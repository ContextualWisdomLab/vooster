import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
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
  description: z.string().min(1),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]),
  priority: z.enum(["P0", "P1", "P2", "P3"])
});

export function registerGoalRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/goals", (request, reply) =>
    createGoal(request, reply, state)
  );
  app.get("/v1/projects/:projectId/goals", (request, reply) =>
    listGoals(request, reply, state)
  );
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

  const actor = activeActorWithId(state, projectId, parsed.data.actor_id);
  if (actor === undefined) {
    return reply.code(422).send(problem(422, "Actor is not available"));
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
  const revision = {
    id: randomUUID(),
    entity_type: "GOAL" as const,
    entity_id: goal.id,
    version_number: 1,
    snapshot: goal
  };

  state.goalsByProjectId.set(projectId, [
    ...(state.goalsByProjectId.get(projectId) ?? []),
    goal
  ]);
  state.revisionsByEntityId.set(goal.id, [revision]);

  return reply.code(201).send({
    goal,
    revision,
    recommended_next_command: "vspec goal list"
  });
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

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
