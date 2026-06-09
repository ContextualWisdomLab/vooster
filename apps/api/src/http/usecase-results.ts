import type { FastifyReply } from "fastify";
import {
  type ApiErrorCode,
  usecaseCreateResponseSchema,
  usecaseUpdateResponseSchema
} from "@vooster/contracts";
import type {
  UseCaseAuthoringResult,
  UseCaseUpdateResult
} from "../application/usecases.js";
import { problem } from "./signup-support.js";

const FORBIDDEN = "FORBIDDEN" satisfies ApiErrorCode;
const NOT_FOUND = "NOT_FOUND" satisfies ApiErrorCode;
const PRIMARY_ACTOR_NOT_AVAILABLE =
  "PRIMARY_ACTOR_NOT_AVAILABLE" satisfies ApiErrorCode;
const TITLE_NOT_VERB_PHRASE = "TITLE_NOT_VERB_PHRASE" satisfies ApiErrorCode;

export function sendUseCaseAuthoringResult(
  reply: FastifyReply,
  result: UseCaseAuthoringResult
) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(useCaseCreateAccessProblem());
    case "TITLE_NOT_VERB_PHRASE":
      return reply.code(422).send(
        problem(
          422,
          "Use case title should be a verb phrase",
          {
            code: TITLE_NOT_VERB_PHRASE,
            offending_word: result.offendingWord,
            suggested_titles: result.suggestedTitles
          },
          [
            {
              command: "vspec usecase create --force",
              reason: "Create anyway after reviewing the title."
            }
          ]
        )
      );
    case "PROJECT_NOT_FOUND":
      return reply
        .code(404)
        .send(problem(404, "Project not found", { code: NOT_FOUND }));
    case "PRIMARY_ACTOR_NOT_AVAILABLE":
      return reply.code(422).send(
        problem(
          422,
          "Primary actor is not available",
          { actor_name: result.actorName, code: PRIMARY_ACTOR_NOT_AVAILABLE },
          [
            {
              command: "vspec actor list",
              reason: "Find a valid actor for this project."
            },
            {
              command: `vspec actor create --name ${result.actorName}`,
              reason: "Create the actor before authoring the use case."
            }
          ]
        )
      );
    case "CREATED":
      return reply.code(201).send(
        usecaseCreateResponseSchema.parse({
          revision: result.revision,
          suggested_next_actions: result.suggestedNextActions,
          usecase: result.usecase
        })
      );
  }
}

export function useCaseCreateAccessProblem() {
  return problem(
    403,
    "Not authorized to create use cases in this project",
    { code: FORBIDDEN },
    [
      {
        command: "vspec login",
        reason: "Authenticate with an account that has project access."
      },
      {
        command: "vspec member set-role",
        reason: "Ask a workspace owner for editor access."
      }
    ]
  );
}

export function sendUseCaseUpdateResult(
  reply: FastifyReply,
  result: UseCaseUpdateResult
) {
  switch (result.status) {
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "NEEDS_STAKEHOLDER_INTEREST":
      return reply
        .code(422)
        .send(problem(422, "Use case needs at least one stakeholder interest"));
    case "UPDATED":
      return reply.send(usecaseUpdateResponseSchema.parse({ usecase: result.usecase }));
  }
}
