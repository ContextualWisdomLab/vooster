import type { FastifyReply } from "fastify";
import type { GherkinExportResult } from "../application/gherkin-export.js";
import {
  archivedUseCaseProblem,
  gherkinPrerequisiteProblem,
  missingRevisionProblem
} from "./gherkin-export-problems.js";
import { problem } from "./signup-support.js";

export function sendGherkinExportProblem(
  reply: FastifyReply,
  result: Exclude<GherkinExportResult, { status: "EXPORTED" }>
) {
  switch (result.status) {
    case "ARCHIVED_USECASE":
      return reply.code(409).send(archivedUseCaseProblem(result.usecase));
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Not authorized to export Gherkin"));
    case "INCOMPLETE_USECASE":
      return reply
        .code(422)
        .send(gherkinPrerequisiteProblem(result.usecase, result.missingRequiredField));
    case "REVISION_NOT_FOUND":
      return reply
        .code(404)
        .send(missingRevisionProblem(result.usecase, result.revisionId));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
  }
}
