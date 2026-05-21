import type { FastifyReply } from "fastify";
import type { WhoIsWorkingResult } from "../application/who-is-working.js";
import { problem } from "./signup-support.js";

export function sendWhoResult(reply: FastifyReply, result: WhoIsWorkingResult) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(workspaceMembershipProblem());
    case "FOUND":
      return reply.send({
        ...(result.archived === true ? { archived: true } : {}),
        locks: result.locks,
        merge_requests: result.mergeRequests,
        sessions: result.sessions,
        suggested_next_actions: result.suggestedNextActions,
        usecase: result.usecase
      });
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(missingUseCaseProblem(result.missingUsecaseId));
  }
}

function missingUseCaseProblem(usecaseId: string) {
  return problem(
    404,
    "Use case not found",
    { key_format: "KEY-NNN" },
    [
      {
        command: `vspec usecase search ${usecaseId}`,
        reason: "Search for the intended use case key."
      }
    ]
  );
}

function workspaceMembershipProblem() {
  return problem(
    403,
    "Workspace membership required",
    {},
    [
      {
        command: "vspec workspace list",
        reason: "Choose a workspace you can access."
      }
    ]
  );
}
