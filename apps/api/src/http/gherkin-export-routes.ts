import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  gherkinExportResponseSchema,
  usecaseExportParamsSchema,
  usecaseExportRequestSchema
} from "@vooster/contracts";
import { exportGherkin as exportGherkinWorkflow } from "../application/gherkin-export.js";
import { existingOutputProblem, outputPathProblem } from "./gherkin-export-problems.js";
import { sendGherkinExportProblem } from "./gherkin-export-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerGherkinExportRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stepStore: StepStore
) {
  app.post("/v1/usecases/:id/export/gherkin", (request, reply) =>
    exportGherkin(
      request,
      reply,
      state,
      actorStore,
      membershipStore,
      revisionStore,
      useCaseStore,
      scenarioStore,
      stepStore
    )
  );
}

async function exportGherkin(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore,
  stepStore: StepStore
) {
  const usecaseId = usecaseExportParamsSchema.parse(request.params).id;
  const parsed = usecaseExportRequestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid Gherkin export request"));
  }

  const result = await exportGherkinWorkflow(
    {
      actorStore,
      membershipStore,
      revisionStore,
      scenarioStore,
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
    return sendGherkinExportProblem(reply, result);
  }

  const outputProblem = outputPathProblem(parsed.data.output_path);
  if (outputProblem !== undefined) {
    return reply.code(400).send(outputProblem);
  }
  if (parsed.data.existing_file_content !== undefined && !parsed.data.force) {
    return reply
      .code(409)
      .send(
        existingOutputProblem(
          result.usecase,
          parsed.data.output_path,
          parsed.data.existing_file_content,
          result.feature
        )
      );
  }
  return reply
    .type("text/plain")
    .send(gherkinExportResponseSchema.parse(result.feature));
}
