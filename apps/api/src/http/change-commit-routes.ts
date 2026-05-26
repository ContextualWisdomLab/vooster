import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  changeCommitRequestSchema,
  changeCommitResponseSchema,
  changeTestPreviewExpireParamsSchema
} from "@vooster/contracts";
import { previewProblem, previews } from "./change-preview-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { StoredUseCase } from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerChangeCommitRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/changes/commit", (request, reply) =>
    commitSpecChange(
      request,
      reply,
      state,
      branchStore,
      projectStore,
      revisionStore,
      useCaseStore
    )
  );
  app.post("/__test/changes/previews/:previewId/expire", (request, reply) => {
    const params = changeTestPreviewExpireParamsSchema.parse(request.params);
    const preview = previews(state).get(params.previewId);
    if (preview === undefined) {
      return reply.code(404).send(problem(404, "Change preview not found"));
    }
    preview.expires_at = new Date(Date.now() - 1_000).toISOString();
    return reply.send({ expired: true });
  });
}

async function commitSpecChange(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = changeCommitRequestSchema.safeParse(request.body);
  const preview = parsed.success
    ? previews(state).get(parsed.data.preview_id)
    : undefined;
  if (preview === undefined) {
    return reply
      .code(400)
      .send(
        previewProblem(
          400,
          "Every commit must reference a still-valid preview",
          "Generate a preview before committing a spec change."
        )
      );
  }
  if (Date.parse(preview.expires_at) <= Date.now()) {
    return reply
      .code(410)
      .send(
        previewProblem(
          410,
          "Change preview expired",
          "Regenerate the preview before committing."
        )
      );
  }
  const usecase = (await useCaseStore.findUseCaseWithProject(preview.usecase_id))
    ?.usecase;
  if (usecase === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const revision = await appendPreviewRevision(
    state,
    branchStore,
    projectStore,
    revisionStore,
    useCaseStore,
    usecase,
    preview.id,
    preview.diff[0]?.after ?? usecase.title
  );
  previews(state).delete(preview.id);
  return reply.send(
    changeCommitResponseSchema.parse({
      revisions: [{ entity_id: usecase.id, revision_id: revision.id }],
      suggested_next_actions: [
        {
          command: `vspec history ${usecase.key}`,
          reason: "Review the committed revision."
        }
      ]
    })
  );
}

async function appendPreviewRevision(
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  usecase: StoredUseCase,
  previewId: string,
  title: string
) {
  const revision = {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: usecase.id,
    version_number: await revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase, title },
    change_summary: `Committed preview ${previewId}`,
    severity: "NON_BREAKING" as const
  };
  usecase.title = title;
  usecase.current_revision_id = revision.id;
  await useCaseStore.updateUseCase(usecase);
  await revisionStore.saveRevision(revision);
  const project = await projectStore.findProjectById(usecase.project_id);
  const main =
    project === undefined
      ? undefined
      : await branchStore.findBranchById(project.default_branch_id);
  if (main !== undefined) {
    main.head_revision_ids = {
      ...(main.head_revision_ids ?? {}),
      [usecase.id]: revision.id
    };
    await branchStore.updateBranch(main);
  }
  return revision;
}
