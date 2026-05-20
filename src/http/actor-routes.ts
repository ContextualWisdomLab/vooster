import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { defineActor } from "../application/actors.js";
import { sendActorDefinitionResult } from "./actor-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredActor } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";

const actorRequestSchema = z.object({
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  is_human: z.boolean(),
  name: z.string().min(1),
  type: z.string()
});

const actorTypes = ["PRIMARY", "SUPPORTING", "OFFSTAGE"] as const;

export function registerActorRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore
) {
  app.post("/v1/projects/:projectId/actors", (request, reply) =>
    createActor(request, reply, state, actorStore, membershipStore, revisionStore)
  );
}

async function createActor(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore
) {
  const projectId = projectIdFrom(request.params);
  const parsed = actorRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid actor request"));
  }

  if (!isActorType(parsed.data.type)) {
    return reply.code(400).send(
      problem(400, "Invalid actor type", {
        valid_types: [...actorTypes]
      })
    );
  }
  return sendActorDefinitionResult(
    reply,
    await defineActor(
      {
        actorStore,
        membershipStore,
        readOnlyMemberships: state.readOnlyMemberships,
        revisionStore
      },
      {
        aliases: parsed.data.aliases,
        description: parsed.data.description,
        isHuman: parsed.data.is_human,
        name: parsed.data.name,
        projectId,
        type: parsed.data.type,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function isActorType(type: string): type is StoredActor["type"] {
  return actorTypes.includes(type as StoredActor["type"]);
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
