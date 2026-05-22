import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { listRevisionHistory } from "../application/revision-history.js";
import { sendRevisionHistoryResult } from "./revision-history-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  project_id: z.string().optional(),
  simulate_server_error: z.literal("true").optional()
});

export function registerRevisionHistoryRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.get("/v1/usecases/:usecaseId/revisions", (request, reply) =>
    listHistory(
      request,
      reply,
      state,
      membershipStore,
      projectStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function listHistory(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = historyQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid history request"));
  }
  return sendRevisionHistoryResult(
    reply,
    await listRevisionHistory(
      { membershipStore, projectStore, revisionStore, useCaseStore },
      {
        limit: parsed.data.limit,
        projectId: parsed.data.project_id,
        simulateReadFailure: parsed.data.simulate_server_error === "true",
        usecaseId: params.usecaseId,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}
