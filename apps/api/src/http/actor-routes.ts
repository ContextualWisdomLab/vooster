import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  actorCreateRequestSchema,
  actorProjectParamsSchema,
  actorTypeSchema
} from "@vooster/contracts";
import { defineActor } from "../application/actors.js";
import {
  archiveActor,
  listActors,
  patchActor,
  showActor
} from "./actor-management-routes.js";
import { sendActorDefinitionResult } from "./actor-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { StoredActor } from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";

export function registerActorRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore
) {
  app.get("/v1/projects/:projectId/actors", (request, reply) =>
    listActors(request, reply, actorStore)
  );
  app.get("/v1/projects/:projectId/actors/:actorId", (request, reply) =>
    showActor(request, reply, actorStore)
  );
  app.post("/v1/projects/:projectId/actors", (request, reply) =>
    createActor(request, reply, state, actorStore, membershipStore, revisionStore)
  );
  app.patch("/v1/projects/:projectId/actors/:actorId", (request, reply) =>
    patchActor(request, reply, actorStore)
  );
  app.delete("/v1/projects/:projectId/actors/:actorId", (request, reply) =>
    archiveActor(request, reply, actorStore)
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
  const parsed = actorCreateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid actor request"));
  }

  if (!isActorType(parsed.data.type)) {
    return reply.code(400).send(
      problem(400, "Invalid actor type", {
        valid_types: actorTypeSchema.options
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
        dryRun: dryRunFromQuery(request.query),
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
  return actorTypeSchema.safeParse(type).success;
}

function projectIdFrom(params: unknown): string {
  return actorProjectParamsSchema.parse(params).projectId;
}

function dryRunFromQuery(query: unknown): boolean {
  if (typeof query !== "object" || query === null) {
    return false;
  }
  return (query as { dry_run?: unknown }).dry_run === "true";
}
