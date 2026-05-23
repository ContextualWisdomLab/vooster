import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  compareUseCaseRevisions,
  type CompareUseCaseRevisionsDeps,
  type CompareUseCaseRevisionsResult
} from "../application/revision-diff.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { StoredUseCase } from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const diffQuerySchema = z.object({
  format: z.enum(["agent", "human", "json"]).default("human"),
  from: z.string().min(1),
  to: z.string().min(1)
});

export function registerRevisionDiffRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.get("/v1/usecases/:usecaseId/diff", (request, reply) =>
    compareRevisions(request, reply, state, {
      branchStore,
      membershipStore,
      revisionStore,
      useCaseStore
    })
  );
}

async function compareRevisions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: CompareUseCaseRevisionsDeps
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = diffQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid diff request"));
  }

  const result = await compareUseCaseRevisions(deps, {
    format: parsed.data.format,
    fromRevisionId: parsed.data.from,
    toRevisionId: parsed.data.to,
    usecaseId: params.usecaseId,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendDiffResult(reply, result);
}

function missingRevisionProblem(usecase: StoredUseCase, revisionId: string) {
  return problem(
    404,
    "Revision not found",
    {
      missing_revision: revisionId,
      usecase: { id: usecase.id, key: usecase.key }
    },
    [
      {
        command: `vspec history ${usecase.key}`,
        reason: "Find valid revision IDs for this use case."
      }
    ]
  );
}

function sendDiffResult(reply: FastifyReply, result: CompareUseCaseRevisionsResult) {
  switch (result.status) {
    case "COMPARED":
      return reply.send(result.diff);
    case "FORBIDDEN":
      return reply.code(403).send(diffAccessProblem());
    case "MISSING_REVISION":
      return reply
        .code(404)
        .send(missingRevisionProblem(result.usecase, result.missingRevision));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
  }
}

function diffAccessProblem() {
  return problem(403, "Not authorized to compare revisions", {}, [
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
