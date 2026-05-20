import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  advanceBranchExtensionRevision,
  advanceBranchUseCaseRevision,
  advanceMainExtensionRevision,
  advanceMainUseCaseRevision
} from "../application/branch-test-helpers.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const branchRevisionSchema = z.object({
  severity: z.enum(["BREAKING", "COSMETIC", "NON_BREAKING"]),
  title: z.string().min(1)
});
const extensionRevisionSchema = z.object({
  condition: z.string().min(1),
  extension_point: z.string().min(1)
});

export function registerBranchTestRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const deps = { branchStore, projectStore, revisionStore, useCaseStore };
  app.post("/__test/branches/:branchId/usecases/:usecaseId/revisions", (request, reply) =>
    advanceBranchUseCase(request, reply, deps)
  );
  app.post("/__test/usecases/:usecaseId/revisions", (request, reply) =>
    advanceMainUseCase(request, reply, deps)
  );
  app.post("/__test/branches/:branchId/usecases/:usecaseId/extensions", (request, reply) =>
    advanceBranchExtension(request, reply, deps)
  );
  app.post("/__test/usecases/:usecaseId/extensions", (request, reply) =>
    advanceMainExtension(request, reply, deps)
  );
}

type BranchTestDeps = {
  branchStore: BranchStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

async function advanceBranchUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: BranchTestDeps
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch revision request"));
  }
  const result = await advanceBranchUseCaseRevision(deps, { ...parsed.data, ...params });
  return sendAdvanceResult(reply, result, "Branch use case not found");
}

async function advanceBranchExtension(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: BranchTestDeps
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = extensionRevisionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch extension request"));
  }
  const result = await advanceBranchExtensionRevision(deps, {
    branchId: params.branchId,
    condition: parsed.data.condition,
    extensionPoint: parsed.data.extension_point,
    usecaseId: params.usecaseId
  });
  return sendAdvanceResult(reply, result, "Branch use case not found");
}

async function advanceMainUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: BranchTestDeps
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid main revision request"));
  }
  const result = await advanceMainUseCaseRevision(deps, { ...parsed.data, ...params });
  return sendAdvanceResult(reply, result, "Use case not found");
}

async function advanceMainExtension(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: BranchTestDeps
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = extensionRevisionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid main extension request"));
  }
  const result = await advanceMainExtensionRevision(deps, {
    condition: parsed.data.condition,
    extensionPoint: parsed.data.extension_point,
    usecaseId: params.usecaseId
  });
  return sendAdvanceResult(reply, result, "Use case not found");
}

function sendAdvanceResult(
  reply: FastifyReply,
  result: { revisionId: string; status: "ADVANCED" } | { status: "NOT_FOUND" },
  notFoundTitle: string
) {
  if (result.status === "NOT_FOUND") {
    return reply.code(404).send(problem(404, notFoundTitle));
  }
  return reply.send({ revision_id: result.revisionId });
}
