import type { FastifyReply } from "fastify";
import type { ImpactResult } from "../application/impact-analysis.js";
import { problem } from "./signup-support.js";

export function sendImpactResult(reply: FastifyReply, result: ImpactResult) {
  switch (result.status) {
    case "NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "ACCESS_DENIED":
      return reply.code(403).send(impactAccessProblem());
    case "PROPOSED_CHANGE_PARSE_FAILED":
      return reply.code(400).send(parseProposedChangeProblem(result.path));
    case "PROPOSED_CHANGE_NOT_READABLE":
      return reply
        .code(400)
        .send(missingProposedChangeProblem(result.usecase, result.path));
    case "REVISION_NOT_FOUND":
      return reply.code(404).send(problem(404, "Revision not found"));
    case "PREVIEWED":
      return reply.send({
        cached: result.cached,
        impact: result.impact,
        preview_id: result.previewId,
        suggested_next_actions: result.nextActions
      });
  }
}

function missingProposedChangeProblem(usecase: { key: string }, path: string) {
  return problem(400, "Proposed change file is not readable", { path }, [
    {
      command: "vspec impact --proposed-change <path>",
      reason: "Verify the proposed-change path and retry."
    },
    {
      command: `vspec impact ${usecase.key}`,
      reason: "Rerun without a proposed-change file to analyze the current head."
    }
  ]);
}

function parseProposedChangeProblem(path: string) {
  return problem(
    400,
    "Proposed change parse failed",
    { parser_error: "Missing frontmatter" },
    [
      {
        command: `vspec doctor ${path}`,
        reason: "Validate the proposed-change file format."
      }
    ]
  );
}

function impactAccessProblem() {
  return problem(403, "Not authorized to preview impact", {}, [
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
