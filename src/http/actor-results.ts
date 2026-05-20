import type { FastifyReply } from "fastify";
import type { ActorDefinitionResult } from "../application/actors.js";
import { problem } from "./signup-support.js";
import type { StoredActor } from "../domain/entities/index.js";

export function sendActorDefinitionResult(
  reply: FastifyReply,
  result: ActorDefinitionResult
) {
  switch (result.status) {
    case "ACTIVE_NAME_CONFLICT":
      return activeNameConflict(reply, result.existingActor, result.requestedName);
    case "ARCHIVED_NAME_CONFLICT":
      return archivedNameConflict(reply, result.existingActor);
    case "CREATED":
      return reply.code(201).send({
        actor: result.actor,
        recommended_next_command: result.recommendedNextCommand,
        revision: result.revision
      });
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "READ_ONLY":
      return readOnly(reply);
    case "SYSTEM_RESERVED":
      return systemReserved(reply);
  }
}

function activeNameConflict(
  reply: FastifyReply,
  existingActor: StoredActor,
  requestedName: string
) {
  return reply.code(422).send(
    problem(422, "Actor name already exists", { existing_actor_id: existingActor.id }, [
      { command: "vspec actor edit", reason: "Amend the existing actor." },
      {
        command: `vspec actor edit --add-alias ${requestedName}`,
        reason: "Attach the submitted name as an alias."
      }
    ])
  );
}

function archivedNameConflict(reply: FastifyReply, existingActor: StoredActor) {
  return reply.code(409).send(
    problem(
      409,
      "Name is held by an archived actor",
      { existing_actor_id: existingActor.id },
      [
        { command: "vspec actor restore", reason: "Restore the archived actor." },
        { command: "vspec actor create", reason: "Choose a different name." }
      ]
    )
  );
}

function readOnly(reply: FastifyReply) {
  return reply
    .code(403)
    .send(
      problem(403, "Contact the workspace owner for edit access", {}, [
        { command: "vspec workspace owner contact", reason: "Request edit access." }
      ])
    );
}

function systemReserved(reply: FastifyReply) {
  return reply.code(422).send(
    problem(422, "System actor name is reserved", {}, [
      {
        command: "vspec actor show System",
        reason: "Inspect the canonical system actor."
      }
    ])
  );
}
