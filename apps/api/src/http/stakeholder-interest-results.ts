import type { FastifyReply } from "fastify";
import type {
  AddStakeholderInterestResult,
  RemoveStakeholderInterestResult
} from "../application/stakeholder-interest.js";
import { unresolvedStakeholderProblem } from "./stakeholder-interest-support.js";
import { problem } from "./signup-support.js";

export function sendAddStakeholderInterestResult(
  reply: FastifyReply,
  result: AddStakeholderInterestResult
) {
  switch (result.status) {
    case "ADDED":
      return reply.code(201).send({
        next_missing_role_hint: result.nextMissingRoleHint,
        revision: result.revision,
        stakeholder_interest: result.stakeholderInterest,
        stakeholder_interests: result.stakeholderInterests
      });
    case "DUPLICATE_INTEREST":
      return reply.code(409).send(duplicateInterestProblem(result.existingInterest));
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "STAKEHOLDER_NOT_FOUND":
      return reply
        .code(422)
        .send(
          unresolvedStakeholderProblem(
            result.candidateStakeholders,
            result.stakeholderName
          )
        );
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
  }
}

export function sendRemoveStakeholderInterestResult(
  reply: FastifyReply,
  result: RemoveStakeholderInterestResult
) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "INTEREST_NOT_FOUND":
      return reply.code(404).send(problem(404, "Stakeholder interest not found"));
    case "REMOVED":
      return reply.send({
        removed_stakeholder_interest_id: result.removedStakeholderInterestId,
        revision: result.revision,
        stakeholder_interests: result.stakeholderInterests,
        ...(result.noStakeholderInterests ? noInterestWarning() : {})
      });
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
  }
}

function duplicateInterestProblem(existingInterest: string) {
  return problem(
    409,
    "Stakeholder interest already exists",
    { existing_interest: existingInterest },
    [
      {
        command: "vspec usecase set --field stakeholder-interest",
        reason: "Edit the existing stakeholder interest."
      }
    ]
  );
}

function noInterestWarning() {
  return {
    warnings: [
      {
        message: "Use case cannot leave DRAFT until an interest is added.",
        type: "NO_STAKEHOLDER_INTERESTS"
      }
    ]
  };
}
