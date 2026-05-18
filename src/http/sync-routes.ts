import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import {
  parseFileErrors,
  parseFilesProblem,
  titleFrom,
  usecaseMarkdown,
  usecasePath
} from "./sync-markdown.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";

const pullSchema = z.object({
  branch: z.string().default("main"),
  since: z.string().optional()
});
const pushSchema = z.object({
  branch: z.string().default("main"),
  files: z.array(z.object({
    base_revision: z.string().min(1),
    content: z.string().min(1),
    path: z.string().min(1)
  })).min(1)
});

type PushFile = z.infer<typeof pushSchema>["files"][number];

export function registerSyncRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/sync/pull", (request, reply) =>
    pullFiles(request, reply, state)
  );
  app.post("/v1/projects/:projectId/sync/push", (request, reply) =>
    pushFiles(request, reply, state)
  );
}

function pullFiles(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  const parsed = pullSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync pull request"));
  }
  if (membershipForProject(request, state, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to sync files"));
  }
  const files = activeUseCases(state, projectId).map((usecase) => ({
    content: usecaseMarkdown(usecase),
    path: usecasePath(usecase),
    revision: usecase.current_revision_id
  }));
  return reply.send({
    cursor: files[0]?.revision ?? "",
    files
  });
}

function pushFiles(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  const parsed = pushSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync push request"));
  }
  if (membershipForProject(request, state, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to sync files"));
  }
  const parseErrors = parsed.data.files.flatMap(parseFileErrors);
  if (parseErrors.length > 0) {
    return reply.code(400).send(parseFilesProblem(parseErrors));
  }
  const results = parsed.data.files.map((file) => pushFile(state, projectId, file));
  return reply.send({
    cache: {
      entries: results.map((result) => ({
        path: result.path,
        revision: result.current_revision,
        status: "SYNCED"
      }))
    },
    results,
    suggested_next_actions: [
      {
        command: "vspec pull",
        reason: "Refresh local files after successful push."
      }
    ]
  });
}

function pushFile(
  state: SignupState,
  projectId: string,
  file: PushFile
) {
  const usecase = activeUseCases(state, projectId).find(
    (candidate) => usecasePath(candidate) === file.path
  );
  if (usecase === undefined) {
    return { current_revision: "", path: file.path, status: "SKIPPED" };
  }
  const title = titleFrom(file.content);
  const revision = syncRevision(state, usecase, title);
  usecase.title = title;
  usecase.current_revision_id = revision.id;
  state.revisionsByEntityId.set(usecase.id, [
    ...(state.revisionsByEntityId.get(usecase.id) ?? []),
    revision
  ]);
  advanceMainHead(state, projectId, usecase.id, revision.id);
  return { current_revision: revision.id, path: file.path, status: "OK" };
}

function syncRevision(
  state: SignupState,
  usecase: StoredUseCase,
  title: string
): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase, title },
    change_summary: `Synced ${usecase.key} from file`,
    parent_revision_id: usecase.current_revision_id,
    severity: "NON_BREAKING"
  };
}

function projectIdFrom(params: unknown) {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}

function activeUseCases(state: SignupState, projectId: string) {
  return (state.usecasesByProjectId.get(projectId) ?? [])
    .filter((usecase) => usecase.archived_at === null);
}

function advanceMainHead(
  state: SignupState,
  projectId: string,
  usecaseId: string,
  revisionId: string
) {
  const project = state.projectsById.get(projectId);
  const branch = project === undefined ? undefined : state.branchesById.get(project.default_branch_id);
  if (branch !== undefined) {
    branch.head_revision_ids = { ...(branch.head_revision_ids ?? {}), [usecaseId]: revisionId };
  }
}
