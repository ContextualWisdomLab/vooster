import type { FastifyReply } from "fastify";
import type { GoalPromotionResult } from "../application/goal-promotion.js";
import { problem } from "./signup-support.js";

export function sendGoalPromotionResult(reply: FastifyReply, result: GoalPromotionResult) {
  switch (result.status) {
    case "ALREADY_PROMOTED":
      return reply.code(409).send(
        problem(409, "Goal is already promoted", {
          existing_usecase_key: result.existingUseCaseKey
        })
      );
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
    case "GOAL_NOT_FOUND":
      return reply.code(404).send(problem(404, "Goal not found"));
    case "PROJECT_NOT_FOUND":
      return reply.code(404).send(problem(404, "Project not found"));
    case "PROMOTED":
      return reply.code(201).send({
        goal: result.goal,
        revision: result.revision,
        suggested_next_actions: suggestedNextActions(result),
        usecase: result.usecase,
        ...(result.titleWarning === undefined ? {} : { warnings: [result.titleWarning] })
      });
    case "PROMOTION_FAILED":
      return reply.code(500).send(
        problem(500, "Promotion failed", { exit_code: 5 }, [
          {
            command: `vspec goal promote ${result.goalId}`,
            reason: "Retry after the server recovers."
          }
        ])
      );
    case "REJECTED_GOAL":
      return reply.code(422).send(
        problem(422, "Rejected goal cannot be promoted", {}, [
          {
            command: `vspec goal edit ${result.goalId} --status in-design`,
            reason: "Reopen the goal before promotion."
          }
        ])
      );
  }
}

function suggestedNextActions(result: Extract<GoalPromotionResult, { status: "PROMOTED" }>) {
  return [
    {
      command: "vspec usecase add-stakeholder",
      reason: "Attach stakeholders and interests."
    },
    { command: "vspec scenario main", reason: "Write the main success scenario." },
    ...(result.titleWarning === undefined
      ? []
      : [
          {
            command: `vspec usecase set ${result.usecase.key} --field title`,
            reason: "Revise the title into a verb phrase."
          }
        ])
  ];
}
