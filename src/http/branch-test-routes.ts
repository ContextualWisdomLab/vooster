import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
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
  app.post("/__test/branches/:branchId/usecases/:usecaseId/revisions", (request, reply) =>
    advanceBranchUseCase(request, reply, revisionStore, branchStore, useCaseStore)
  );
  app.post("/__test/usecases/:usecaseId/revisions", (request, reply) =>
    advanceMainUseCase(request, reply, revisionStore, branchStore, projectStore, useCaseStore)
  );
  app.post("/__test/branches/:branchId/usecases/:usecaseId/extensions", (request, reply) =>
    advanceBranchExtension(request, reply, revisionStore, branchStore, useCaseStore)
  );
  app.post("/__test/usecases/:usecaseId/extensions", (request, reply) =>
    advanceMainExtension(request, reply, revisionStore, branchStore, projectStore, useCaseStore)
  );
}

async function advanceBranchUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  revisionStore: RevisionStore,
  branchStore: BranchStore,
  useCaseStore: UseCaseStore
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  const branch = await branchStore.findBranchById(params.branchId);
  const usecase = (await useCaseStore.findUseCaseWithProject(params.usecaseId))?.usecase;
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch revision request"));
  }
  if (branch === undefined || usecase === undefined) {
    return reply.code(404).send(problem(404, "Branch use case not found"));
  }
  const revision = await useCaseRevision(revisionStore, usecase, parsed.data, branch.id);
  branch.head_revision_ids = {
    ...(branch.head_revision_ids ?? branch.base_revision_ids ?? {}),
    [usecase.id]: revision.id
  };
  await revisionStore.saveRevision(revision);
  await branchStore.updateBranch(branch);
  await useCaseStore.updateUseCase(usecase);
  return reply.send({ revision_id: revision.id });
}

async function advanceBranchExtension(
  request: FastifyRequest,
  reply: FastifyReply,
  revisionStore: RevisionStore,
  branchStore: BranchStore,
  useCaseStore: UseCaseStore
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = extensionRevisionSchema.safeParse(request.body);
  const branch = await branchStore.findBranchById(params.branchId);
  const usecase = (await useCaseStore.findUseCaseWithProject(params.usecaseId))?.usecase;
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch extension request"));
  }
  if (branch === undefined || usecase === undefined) {
    return reply.code(404).send(problem(404, "Branch use case not found"));
  }
  const revision = await extensionRevision(revisionStore, usecase, parsed.data, branch.id);
  branch.head_revision_ids = {
    ...(branch.head_revision_ids ?? branch.base_revision_ids ?? {}),
    [usecase.id]: revision.id
  };
  await revisionStore.saveRevision(revision);
  await branchStore.updateBranch(branch);
  await useCaseStore.updateUseCase(usecase);
  return reply.send({ revision_id: revision.id });
}

async function advanceMainUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  revisionStore: RevisionStore,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  const usecase = (await useCaseStore.findUseCaseWithProject(params.usecaseId))?.usecase;
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid main revision request"));
  }
  if (usecase === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const revision = await useCaseRevision(revisionStore, usecase, parsed.data);
  usecase.title = parsed.data.title;
  usecase.current_revision_id = revision.id;
  await useCaseStore.updateUseCase(usecase);
  await revisionStore.saveRevision(revision);
  const project = await projectStore.findProjectById(usecase.project_id);
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
  revisionStore: RevisionStore,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = extensionRevisionSchema.safeParse(request.body);
  const usecase = (await useCaseStore.findUseCaseWithProject(params.usecaseId))?.usecase;
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid main extension request"));
  }
  if (usecase === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const revision = await extensionRevision(revisionStore, usecase, parsed.data);
  usecase.current_revision_id = revision.id;
  await useCaseStore.updateUseCase(usecase);
  await revisionStore.saveRevision(revision);
  const project = await projectStore.findProjectById(usecase.project_id);
  const main = project === undefined
    ? undefined
    : await branchStore.findBranchById(project.default_branch_id);
  if (main !== undefined) {
    main.head_revision_ids = { ...(main.head_revision_ids ?? {}), [usecase.id]: revision.id };
    await branchStore.updateBranch(main);
  }
  return reply.send({ revision_id: revision.id });
}

async function useCaseRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase,
  data: { severity: "BREAKING" | "COSMETIC" | "NON_BREAKING"; title: string },
  branchId?: string
): Promise<StoredRevision> {
  return {
    ...(branchId === undefined ? {} : { branch_id: branchId }),
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: await revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase, title: data.title },
    severity: data.severity
  };
}

async function extensionRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase,
  data: { condition: string; extension_point: string },
  branchId?: string
): Promise<StoredRevision> {
  return {
    ...(branchId === undefined ? {} : { branch_id: branchId }),
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: await revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase },
    change_summary: `extension:${data.extension_point}:${data.condition}`,
    severity: "NON_BREAKING"
  };
}
