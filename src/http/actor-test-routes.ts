import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SignupState } from "./signup-types.js";

export function registerActorTestRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/__test/projects/:projectId/actors/:actorId/archive", (request, reply) =>
    archiveActor(request, reply, state)
  );
  app.post("/__test/workspaces/:workspaceId/members/:userId/read-only", (request, reply) =>
    markReadOnly(request, reply, state)
  );
}

function archiveActor(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const params = z
    .object({ actorId: z.string().min(1), projectId: z.string().min(1) })
    .parse(request.params);
  const actor = (state.actorsByProjectId.get(params.projectId) ?? []).find(
    (candidate) => candidate.id === params.actorId
  );
  if (actor !== undefined) {
    actor.archived_at = new Date().toISOString();
  }

  return reply.send({ archived: actor !== undefined });
}

function markReadOnly(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const params = z
    .object({ userId: z.string().min(1), workspaceId: z.string().min(1) })
    .parse(request.params);
  state.readOnlyMemberships.add(`${params.userId}:${params.workspaceId}`);
  return reply.send({ read_only: true });
}
