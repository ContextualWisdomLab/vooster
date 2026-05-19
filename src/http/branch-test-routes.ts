import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";

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
  branchStore: BranchStore
) {
  app.post("/__test/branches/:branchId/usecases/:usecaseId/revisions", (request, reply) =>
    advanceBranchUseCase(request, reply, state, branchStore)
  );
  app.post("/__test/usecases/:usecaseId/revisions", (request, reply) =>
    advanceMainUseCase(request, reply, state, branchStore)
  );
  app.post("/__test/branches/:branchId/usecases/:usecaseId/extensions", (request, reply) =>
    advanceBranchExtension(request, reply, state, branchStore)
  );
  app.post("/__test/usecases/:usecaseId/extensions", (request, reply) =>
    advanceMainExtension(request, reply, state, branchStore)
  );
}

async function advanceBranchUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  const branch = await branchStore.findBranchById(params.branchId);
  const usecase = [...state.usecasesByProjectId.values()]
    .flat()
    .find((candidate) => candidate.id === params.usecaseId);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch revision request"));
  }
  if (branch === undefined || usecase === undefined) {
    return reply.code(404).send(problem(404, "Branch use case not found"));
  }
  const revision = useCaseRevision(state, usecase, parsed.data);
  branch.head_revision_ids = {
    ...(branch.head_revision_ids ?? branch.base_revision_ids ?? {}),
    [usecase.id]: revision.id
  };
  state.revisionsByEntityId.set(usecase.id, [
    ...(state.revisionsByEntityId.get(usecase.id) ?? []),
    revision
  ]);
  await branchStore.updateBranch(branch);
  return reply.send({ revision_id: revision.id });
}

async function advanceBranchExtension(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = extensionRevisionSchema.safeParse(request.body);
  const branch = await branchStore.findBranchById(params.branchId);
  const usecase = useCaseById(state, params.usecaseId);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch extension request"));
  }
  if (branch === undefined || usecase === undefined) {
    return reply.code(404).send(problem(404, "Branch use case not found"));
  }
  const revision = extensionRevision(state, usecase, parsed.data);
  branch.head_revision_ids = {
    ...(branch.head_revision_ids ?? branch.base_revision_ids ?? {}),
    [usecase.id]: revision.id
  };
  appendRevision(state, usecase.id, revision);
  await branchStore.updateBranch(branch);
  return reply.send({ revision_id: revision.id });
}

async function advanceMainUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  const usecase = [...state.usecasesByProjectId.values()]
    .flat()
    .find((candidate) => candidate.id === params.usecaseId);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid main revision request"));
  }
  if (usecase === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const revision = useCaseRevision(state, usecase, parsed.data);
  usecase.title = parsed.data.title;
  usecase.current_revision_id = revision.id;
  state.revisionsByEntityId.set(usecase.id, [
    ...(state.revisionsByEntityId.get(usecase.id) ?? []),
    revision
  ]);
  const project = state.projectsById.get(usecase.project_id);
  const main = project === undefined
    ? undefined
    : await branchStore.findBranchById(project.default_branch_id);
  if (main !== undefined) {
    main.head_revision_ids = { ...(main.head_revision_ids ?? {}), [usecase.id]: revision.id };
    await branchStore.updateBranch(main);
  }
  return reply.send({ revision_id: revision.id });
}

async function advanceMainExtension(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = extensionRevisionSchema.safeParse(request.body);
  const usecase = useCaseById(state, params.usecaseId);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid main extension request"));
  }
  if (usecase === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const revision = extensionRevision(state, usecase, parsed.data);
  usecase.current_revision_id = revision.id;
  appendRevision(state, usecase.id, revision);
  const project = state.projectsById.get(usecase.project_id);
  const main = project === undefined
    ? undefined
    : await branchStore.findBranchById(project.default_branch_id);
  if (main !== undefined) {
    main.head_revision_ids = { ...(main.head_revision_ids ?? {}), [usecase.id]: revision.id };
    await branchStore.updateBranch(main);
  }
  return reply.send({ revision_id: revision.id });
}

function useCaseRevision(
  state: SignupState,
  usecase: StoredUseCase,
  data: { severity: "BREAKING" | "COSMETIC" | "NON_BREAKING"; title: string }
): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase, title: data.title },
    severity: data.severity
  };
}

function extensionRevision(
  state: SignupState,
  usecase: StoredUseCase,
  data: { condition: string; extension_point: string }
): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase },
    change_summary: `extension:${data.extension_point}:${data.condition}`,
    severity: "NON_BREAKING"
  };
}

function appendRevision(state: SignupState, usecaseId: string, revision: StoredRevision) {
  state.revisionsByEntityId.set(usecaseId, [
    ...(state.revisionsByEntityId.get(usecaseId) ?? []),
    revision
  ]);
}

function useCaseById(state: SignupState, usecaseId: string): StoredUseCase | undefined {
  return [...state.usecasesByProjectId.values()]
    .flat()
    .find((candidate) => candidate.id === usecaseId);
}
