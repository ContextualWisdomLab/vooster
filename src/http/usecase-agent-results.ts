import type { FastifyReply } from "fastify";
import type { ShowUseCaseResult } from "../application/usecase-agent-types.js";
import { problem } from "./signup-support.js";

export function sendUseCaseAgentResult(reply: FastifyReply, result: ShowUseCaseResult) {
  switch (result.status) {
    case "NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "AUTHENTICATION_REQUIRED":
      return reply.code(401).send(
        problem(401, "Authentication required", {}, [
          {
            command: "vspec login",
            reason: "Authenticate before fetching private specs."
          },
          {
            command: "vspec api-key create --scopes read",
            reason: "Create a read-scoped key for non-interactive agents."
          }
        ])
      );
    case "ARCHIVED":
      return reply.code(404).send(
        problem(404, "Use case not found", {}, [
          {
            command: "vspec usecase list --status=",
            reason: "List visible use cases, including archived ones when authorized."
          }
        ])
      );
    case "SIMPLE":
      return reply.send({ usecase: result.usecase });
    case "REVISION_NOT_FOUND":
      return reply.code(404).send(
        problem(404, "Revision not found", { revision: result.revision }, [
          {
            command: `vspec history ${result.usecaseKey}`,
            reason: "Find a valid revision for this use case."
          }
        ])
      );
    case "AGENT_ENVELOPE":
      return reply.send(result.envelope);
  }
}
