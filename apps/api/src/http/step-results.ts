import type { FastifyReply } from "fastify";
import { stepMoveResponseSchema, stepUpdateResponseSchema } from "@vooster/contracts";
import type { MoveScenarioStepResult } from "../application/scenario-authoring.js";
import { activeRewrite, type StepEditingResult } from "../application/step-editing.js";
import { hardLockProblem, semanticLockProblem } from "./step-lock-support.js";
import { problem, usecaseShowRecoveryActions } from "./signup-support.js";

export function sendStepEditingResult(reply: FastifyReply, result: StepEditingResult) {
  switch (result.status) {
    case "STEP_NOT_FOUND":
      return reply
        .code(404)
        .send(problem(404, "Step not found", {}, usecaseShowRecoveryActions()));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "STALE_BASE":
      return reply
        .code(409)
        .send(
          staleBaseRevisionProblem(
            result.usecase,
            result.baseRevision,
            result.currentRevision
          )
        );
    case "EMPTY_ACTION":
      return reply.code(400).send(problem(400, "Step action is required"));
    case "NO_CHANGES":
      return reply.code(400).send(noStepChangesProblem());
    case "UNKNOWN_ACTOR":
      return reply.code(422).send(unknownStepActorProblem(result.knownActors));
    case "PASSIVE_ACTION":
      return reply.code(422).send(passiveStepEditProblem(result.action));
    case "HARD_LOCKED":
      return reply.code(409).send(hardLockProblem(result.usecase, result.lock));
    case "SEMANTIC_LOCKED":
      return reply.code(409).send(semanticLockProblem(result.usecase, result.lock));
    case "UPDATED":
      return reply.send(
        stepUpdateResponseSchema.parse({
          affected_sessions: result.affectedSessions,
          revision: result.revision,
          step: result.step
        })
      );
  }
}

export function sendStepMoveResult(
  reply: FastifyReply,
  result: MoveScenarioStepResult
) {
  switch (result.status) {
    case "STEP_NOT_FOUND":
      return reply
        .code(404)
        .send(problem(404, "Step not found", {}, usecaseShowRecoveryActions()));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "STEP_MOVED":
      return reply.send(
        stepMoveResponseSchema.parse({
          revision: result.revision,
          scenario_steps: result.scenarioSteps,
          step: result.step
        })
      );
  }
}

function noStepChangesProblem() {
  return problem(
    400,
    "No step changes supplied",
    { editable_fields: ["--action", "--actor", "--implements"] },
    [
      {
        command: "vspec help step edit",
        reason: "Review editable fields; step edit does not reorder steps."
      }
    ]
  );
}

function unknownStepActorProblem(knownActorNames: string[]) {
  return problem(
    422,
    "Step actor is not registered",
    { known_actors: knownActorNames },
    [
      {
        command: "vspec actor create",
        reason: "Create the actor before assigning this step."
      }
    ]
  );
}

function staleBaseRevisionProblem(
  usecase: { key: string },
  baseRevision: string,
  currentRevision: string
) {
  return problem(
    409,
    "Base revision is stale",
    {
      current_revision_id: currentRevision,
      revision_diff: {
        base_revision: baseRevision,
        current_revision: currentRevision
      }
    },
    [
      {
        command: `vspec usecase show ${usecase.key}`,
        reason: "Inspect the current use case before retrying the step edit."
      }
    ]
  );
}

function passiveStepEditProblem(action: string) {
  return problem(
    422,
    "Step action uses passive voice",
    { suggested_action: activeRewrite(action) },
    [
      {
        command: "vspec step edit --force",
        reason: "Persist this wording after reviewing the passive voice warning."
      }
    ]
  );
}
