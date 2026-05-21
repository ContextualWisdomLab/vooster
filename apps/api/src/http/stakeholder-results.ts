import type { FastifyReply } from "fastify";
import type { CreateStakeholderResult } from "../application/stakeholders.js";
import { problem } from "./signup-support.js";

export function sendCreateStakeholderResult(
  reply: FastifyReply,
  result: CreateStakeholderResult
) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send({
        revision: result.revision,
        stakeholder: result.stakeholder,
        recommended_next_command: "vspec usecase add-stakeholder"
      });
    case "WORKSPACE_ARCHIVED":
      return reply.code(409).send(problem(409, "Workspace has been archived"));
    case "ACTOR_REQUIRED_FOR_STEPS":
      return reply.code(400).send(
        problem(400, "Actors do; stakeholders care", {}, [
          {
            command: "vspec actor create",
            reason: "Create an actor for step actions."
          }
        ])
      );
    case "INVALID_TYPE":
      return reply.code(400).send(
        problem(400, "Invalid stakeholder type", {
          valid_types: result.validTypes
        })
      );
    case "DUPLICATE_NAME":
      return reply.code(422).send(
        problem(
          422,
          "Stakeholder name already exists",
          { existing_stakeholder_id: result.existingStakeholder.id },
          [
            {
              command: "vspec stakeholder edit",
              reason: "Amend the existing stakeholder."
            }
          ]
        )
      );
  }
}
