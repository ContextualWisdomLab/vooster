import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredActor, StoredMembership } from "./signup-types.js";

const actorRequestSchema = z.object({
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  is_human: z.boolean(),
  name: z.string().min(1),
  type: z.enum(["PRIMARY", "SUPPORTING", "OFFSTAGE"])
});

export function registerActorRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/actors", (request, reply) =>
    createActor(request, reply, state)
  );
}

function createActor(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  const membership = membershipForProject(request, state, projectId);
  if (membership === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const parsed = actorRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid actor request"));
  }

  const existing = activeActorNamed(state, projectId, parsed.data.name);
  if (existing !== undefined) {
    return reply.code(422).send(
      problem(
        422,
        "Actor name already exists",
        { existing_actor_id: existing.id },
        [
          { command: "vspec actor edit", reason: "Amend the existing actor." },
          {
            command: `vspec actor edit --add-alias ${parsed.data.name}`,
            reason: "Attach the submitted name as an alias."
          }
        ]
      )
    );
  }

  const actor: StoredActor = {
    id: randomUUID(),
    project_id: projectId,
    name: parsed.data.name,
    type: parsed.data.type,
    description: parsed.data.description,
    is_human: parsed.data.is_human,
    aliases: parsed.data.aliases,
    archived_at: null
  };
  const revision = {
    id: randomUUID(),
    entity_type: "ACTOR" as const,
    entity_id: actor.id,
    version_number: 1,
    snapshot: actor
  };

  state.actorsByProjectId.set(projectId, [
    ...(state.actorsByProjectId.get(projectId) ?? []),
    actor
  ]);
  state.revisionsByEntityId.set(actor.id, [revision]);

  return reply.code(201).send({
    actor,
    revision,
    recommended_next_command: "vspec stakeholder create"
  });
}

function activeActorNamed(
  state: SignupState,
  projectId: string,
  name: string
): StoredActor | undefined {
  return (state.actorsByProjectId.get(projectId) ?? []).find(
    (actor) => actor.name === name && actor.archived_at === null
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
