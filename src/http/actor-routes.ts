import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  isReadOnlyMembership,
  membershipForProject as inMemoryMembershipForProject
} from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredActor } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { SignupStore } from "../ports/signup-store.js";

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
  store: SignupStore | undefined
) {
  app.post("/v1/projects/:projectId/actors", (request, reply) =>
    createActor(request, reply, state, actorStore, store)
  );
}

async function createActor(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  store: SignupStore | undefined
) {
  const projectId = projectIdFrom(request.params);
  const membership = await membershipForProject(request, state, projectId, store);
  if (membership === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (isReadOnlyMembership(state, membership)) {
    return readOnly(reply);
  }

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

  if (parsed.data.name === "System") {
    return reply.code(422).send(
      problem(422, "System actor name is reserved", {}, [
        {
          command: "vspec actor show System",
          reason: "Inspect the canonical system actor."
        }
      ])
    );
  }

  const existingByName = await actorStore.findActorByName(projectId, parsed.data.name);
  if (existingByName?.archived_at !== null && existingByName !== undefined) {
    return reply.code(409).send(
      problem(
        409,
        "Name is held by an archived actor",
        { existing_actor_id: existingByName.id },
        [
          { command: "vspec actor restore", reason: "Restore the archived actor." },
          { command: "vspec actor create", reason: "Choose a different name." }
        ]
      )
    );
  }

  if (existingByName !== undefined) {
    return reply.code(422).send(
      problem(
        422,
        "Actor name already exists",
        { existing_actor_id: existingByName.id },
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

  await actorStore.saveActor(actor);
  state.revisionsByEntityId.set(actor.id, [revision]);

  return reply.code(201).send({
    actor,
    revision,
    recommended_next_command: "vspec stakeholder create"
  });
}

function readOnly(reply: FastifyReply) {
  return reply.code(403).send(
    problem(403, "Contact the workspace owner for edit access", {}, [
      { command: "vspec workspace owner contact", reason: "Request edit access." }
    ])
  );
}

function isActorType(type: string): type is StoredActor["type"] {
  return actorTypes.includes(type as StoredActor["type"]);
}

async function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  projectId: string,
  store: SignupStore | undefined
) {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (store !== undefined && userId !== undefined) {
    return store.membershipForProject(projectId, userId);
  }

  return inMemoryMembershipForProject(request, state, projectId);
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
