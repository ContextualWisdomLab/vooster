import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

export function registerActorTestRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore
) {
  app.post("/__test/projects/:projectId/actors/:actorId/archive", (request, reply) =>
    archiveActor(request, reply, actorStore)
  );
  app.post(
    "/__test/workspaces/:workspaceId/members/:userId/read-only",
    (request, reply) => markReadOnly(request, reply, state)
  );
  app.post("/__test/workspaces/:workspaceId/members/:userId", (request, reply) =>
    addTestMember(request, reply, membershipStore)
  );
}

async function archiveActor(
  request: FastifyRequest,
  reply: FastifyReply,
  actorStore: ActorStore
) {
  const params = z
    .object({ actorId: z.string().min(1), projectId: z.string().min(1) })
    .parse(request.params);
  const archived = await actorStore.archiveActor(
    params.projectId,
    params.actorId,
    new Date().toISOString()
  );

  return reply.send({ archived });
}

function markReadOnly(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const params = z
    .object({ userId: z.string().min(1), workspaceId: z.string().min(1) })
    .parse(request.params);
  state.readOnlyMemberships.add(`${params.userId}:${params.workspaceId}`);
  return reply.send({ read_only: true });
}

async function addTestMember(
  request: FastifyRequest,
  reply: FastifyReply,
  membershipStore: MembershipStore
) {
  const params = z
    .object({ userId: z.string().min(1), workspaceId: z.string().min(1) })
    .parse(request.params);
  await membershipStore.saveMembership({
    id: randomUUID(),
    role: "OWNER",
    user_id: params.userId,
    workspace_id: params.workspaceId
  });
  return reply.send({ member: true });
}
