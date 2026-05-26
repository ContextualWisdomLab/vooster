import type { FastifyReply } from "fastify";
import { revisionHistoryResponseSchema } from "@vooster/contracts";
import type { RevisionHistoryResult } from "../application/revision-history.js";
import { problem } from "./signup-support.js";

export function sendRevisionHistoryResult(
  reply: FastifyReply,
  result: RevisionHistoryResult
) {
  switch (result.status) {
    case "LISTED":
      return reply.send(revisionHistoryResponseSchema.parse(result.history));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(missingHistoryProblem(result.projectKey));
    case "FORBIDDEN":
      return reply.code(403).send(historyAccessProblem());
    case "READ_FAILED":
      return reply.code(500).send(historyReadFailureProblem(result.usecase.key));
  }
}

function missingHistoryProblem(projectKey: string) {
  return problem(404, "Use case not found", { project_key: projectKey }, [
    {
      command: `vspec usecase list --project ${projectKey}`,
      reason: "Find a use case in the current project."
    }
  ]);
}

function historyAccessProblem() {
  return problem(403, "Not authorized to view revision history", {}, [
    {
      command: "vspec login",
      reason: "Authenticate with an account that has project access."
    },
    {
      command: "vspec member set-role",
      reason: "Ask a workspace owner for read access."
    }
  ]);
}

function historyReadFailureProblem(usecaseKey: string) {
  return problem(500, "Revision history read failed", { exit_code: 5 }, [
    {
      command: `vspec history ${usecaseKey} --retry`,
      reason: "Retry the history request."
    }
  ]);
}
