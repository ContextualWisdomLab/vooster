import type { FastifyReply } from "fastify";
import {
  goalCreateResponseSchema,
  goalListResponseSchema,
  goalPatchResponseSchema
} from "@vooster/contracts";
import {
  allowedGoalStatusTransitions,
  type CreateGoalResult,
  type ListGoalsResult,
  type PatchGoalResult
} from "../application/actor-goals.js";
import { problem } from "./signup-support.js";

export function sendCreateGoalResult(reply: FastifyReply, result: CreateGoalResult) {
  switch (result.status) {
    case "ACTOR_UNAVAILABLE":
      return reply.code(422).send(actorUnavailableProblem(result.actorId));
    case "CREATED":
      return reply.code(201).send(goalCreateResponse(result));
    case "FORBIDDEN":
      return reply.code(403).send(accessProblem());
    case "WORKSPACE_ARCHIVED":
      return reply.code(409).send(archivedWorkspaceProblem());
  }
}

export function sendPatchGoalResult(reply: FastifyReply, result: PatchGoalResult) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(accessProblem());
    case "GOAL_NOT_FOUND":
      return reply.code(404).send(problem(404, "Goal not found"));
    case "ILLEGAL_STATUS_TRANSITION":
      return reply.code(422).send(
        problem(422, "Illegal status transition", {
          allowed_status_transitions: allowedGoalStatusTransitions
        })
      );
    case "PATCHED":
      return reply.send(
        goalPatchResponseSchema.parse({ goal: result.goal, revision: result.revision })
      );
    case "PROMOTED_REJECT_REQUIRES_ARCHIVE":
      return reply.code(422).send(promotedRejectProblem());
    case "WORKSPACE_ARCHIVED":
      return reply.code(409).send(archivedWorkspaceProblem());
  }
}

export function sendListGoalsResult(reply: FastifyReply, result: ListGoalsResult) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(accessProblem());
    case "LISTED":
      return reply.send(goalListResponseSchema.parse({ actors: result.actors }));
  }
}

function accessProblem() {
  return problem(403, "Contact the workspace owner for access");
}

function archivedWorkspaceProblem() {
  return problem(409, "Workspace has been archived");
}

function actorUnavailableProblem(actorId: string) {
  return problem(422, "Actor is not available", { actor_id: actorId }, [
    { command: "vspec actor list", reason: "Find a valid actor for this project." },
    {
      command: "vspec actor create",
      reason: "Create the actor before assigning goals."
    }
  ]);
}

function goalCreateResponse(result: Extract<CreateGoalResult, { status: "CREATED" }>) {
  return goalCreateResponseSchema.parse({
    goal: result.goal,
    recommended_next_command: "vspec goal list",
    revision: result.revision,
    ...(result.duplicateGoalId === undefined
      ? {}
      : {
          warnings: [
            {
              candidate_goal_id: result.duplicateGoalId,
              command: `vspec goal show ${result.duplicateGoalId}`,
              type: "NEAR_DUPLICATE_GOAL"
            }
          ]
        })
  });
}

function promotedRejectProblem() {
  return problem(422, "Use case must be archived before rejecting this goal", {}, [
    {
      command: "vspec usecase archive",
      reason: "Deprecate the linked use case before rejecting the goal."
    }
  ]);
}
