import type { FastifyReply, FastifyRequest } from "fastify";
import {
  actorArchiveResponseSchema,
  actorListResponseSchema,
  actorParamsSchema,
  actorPatchRequestSchema,
  actorProjectParamsSchema,
  actorResponseSchema,
  actorTypeSchema,
  type ActorPatchRequest
} from "@vooster/contracts";

import { problem } from "./signup-support.js";
import type { StoredActor } from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";

export async function listActors(
  request: FastifyRequest,
  reply: FastifyReply,
  actorStore: ActorStore
) {
  const projectId = projectIdFrom(request.params);
  const actors = (await actorStore.listActors(projectId)).filter(
    (actor) => actor.archived_at === null
  );
  return reply.send(
    actorListResponseSchema.parse({ items: actors.map(actorResponse) })
  );
}

export async function showActor(
  request: FastifyRequest,
  reply: FastifyReply,
  actorStore: ActorStore
) {
  const params = actorParamsFrom(request.params);
  const actor = await actorStore.findActorById(params.projectId, params.actorId);
  if (actor === undefined) {
    return reply.code(404).send(problem(404, "Actor not found"));
  }
  return reply.send(actorResponseSchema.parse({ actor: actorResponse(actor) }));
}

export async function patchActor(
  request: FastifyRequest,
  reply: FastifyReply,
  actorStore: ActorStore
) {
  const params = actorParamsFrom(request.params);
  const parsed = actorPatchRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid actor update"));
  }
  const actor = await actorStore.findActorById(params.projectId, params.actorId);
  if (actor === undefined) {
    return reply.code(404).send(problem(404, "Actor not found"));
  }
  if (actorStore.updateActor === undefined) {
    return reply.code(500).send(problem(500, "Actor updates are not configured"));
  }
  const updated = { ...actor, ...actorPatchFrom(actor, parsed.data) };
  await actorStore.updateActor(updated);
  return reply.send(actorResponseSchema.parse({ actor: actorResponse(updated) }));
}

export async function archiveActor(
  request: FastifyRequest,
  reply: FastifyReply,
  actorStore: ActorStore
) {
  const params = actorParamsFrom(request.params);
  const archived = await actorStore.archiveActor(
    params.projectId,
    params.actorId,
    new Date().toISOString()
  );
  if (!archived) {
    return reply.code(404).send(problem(404, "Actor not found"));
  }
  return reply.send(
    actorArchiveResponseSchema.parse({ actor: { id: params.actorId }, archived: true })
  );
}

function actorPatchFrom(
  actor: StoredActor,
  patch: ActorPatchRequest
): Partial<StoredActor> {
  return {
    aliases: patch.aliases ?? actor.aliases,
    description: patch.description ?? actor.description,
    is_human: patch.is_human ?? actor.is_human,
    name: patch.name ?? actor.name,
    type: patch.type === undefined ? actor.type : actorTypeFrom(patch.type)
  };
}

function isActorType(type: string): type is StoredActor["type"] {
  return actorTypeSchema.safeParse(type).success;
}

function actorTypeFrom(type: string): StoredActor["type"] {
  if (isActorType(type)) {
    return type;
  }
  throw new Error("Invalid actor type.");
}

function projectIdFrom(params: unknown): string {
  return actorProjectParamsSchema.parse(params).projectId;
}

function actorParamsFrom(params: unknown): { actorId: string; projectId: string } {
  return actorParamsSchema.parse(params);
}

function actorResponse(actor: StoredActor) {
  return {
    aliases: actor.aliases,
    description: actor.description,
    id: actor.id,
    is_human: actor.is_human,
    name: actor.name,
    type: actor.type
  };
}
