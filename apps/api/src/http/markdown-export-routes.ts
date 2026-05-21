import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  exportMarkdown as exportMarkdownWorkflow, type MarkdownExportResult
} from "../application/markdown-export.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import {
  existingOutputProblem, missingMarkdownRevisionProblem, outputPathProblem
} from "./markdown-export-problems.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

const paramsSchema = z.object({ id: z.string().min(1) });
const exportSchema = z.object({
  existing_file_content: z.string().optional(),
  force: z.boolean().default(false),
  output_path: z.string().optional(),
  revision_id: z.string().optional()
});

export function registerMarkdownExportRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  stepStore: StepStore
) {
  app.post("/v1/usecases/:id/export/markdown", (request, reply) =>
    exportMarkdown(
      request,
      reply,
      state,
      actorStore,
      membershipStore,
      revisionStore,
      useCaseStore,
      scenarioStore,
      stakeholderInterestStore,
      stakeholderStore,
      stepStore
    )
  );
}

async function exportMarkdown(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  stepStore: StepStore
) {
  const usecaseId = paramsSchema.parse(request.params).id;
  const parsed = exportSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid markdown export request"));
  }

  const result = await exportMarkdownWorkflow(
    {
      actorStore,
      membershipStore,
      revisionStore,
      scenarioStore,
      stakeholderInterestStore,
      stakeholderStore,
      stepStore,
      useCaseStore
    },
    {
      revisionId: parsed.data.revision_id,
      usecaseId,
      userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
    }
  );
  if (result.status !== "EXPORTED") {
    return sendMarkdownExportProblem(reply, result);
  }

  const outputProblem = outputPathProblem(parsed.data.output_path);
  if (outputProblem !== undefined) {
    return reply.code(400).send(outputProblem);
  }
  if (parsed.data.existing_file_content !== undefined && !parsed.data.force) {
    return reply
      .code(409)
      .send(existingOutputProblem(parsed.data.existing_file_content, result.markdown));
  }
  return reply
    .header("x-vspec-round-trip-self-check", "passed")
    .type("text/markdown")
    .send(result.markdown);
}

function sendMarkdownExportProblem(reply: FastifyReply, result: MarkdownExportResult) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Not authorized to export markdown"));
    case "INCOMPLETE_USECASE":
      return reply.code(422).send(incompleteMarkdownProblem(result.usecase));
    case "REVISION_NOT_FOUND":
      return reply
        .code(404)
        .send(missingMarkdownRevisionProblem(result.usecase, result.revisionId));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    case "EXPORTED":
      return reply.send(result.markdown);
  }
}

function incompleteMarkdownProblem(usecase: { key: string }) {
  return problem(
    422,
    "Cannot export incomplete use case",
    { missing_required_field: "main_success.steps" },
    [
      {
        command: `vspec doctor ${usecase.key}`,
        reason: "Inspect missing markdown export prerequisites."
      }
    ]
  );
}
