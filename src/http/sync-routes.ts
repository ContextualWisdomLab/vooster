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
import {
  cacheEntries,
  networkFailureProblem,
  staleFileConflict,
  suggestedSyncActions,
  type SyncResult
} from "./sync-result-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const pullSchema = z.object({
  branch: z.string().default("main"),
  since: z.string().optional()
});
const pushSchema = z.object({
  branch: z.string().default("main"),
  dry_run: z.boolean().default(false),
  files: z.array(z.object({
    base_revision: z.string().min(1),
    content: z.string().min(1),
    path: z.string().min(1)
  })).min(1),
  simulate_network_failure: z.boolean().default(false)
});

type PushFile = z.infer<typeof pushSchema>["files"][number];

export function registerSyncRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/projects/:projectId/sync/pull", (request, reply) =>
    pullFiles(request, reply, state, membershipStore, useCaseStore)
  );
  app.post("/v1/projects/:projectId/sync/push", (request, reply) =>
    pushFiles(
      request,
      reply,
      state,
      branchStore,
      membershipStore,
      projectStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function pullFiles(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const projectId = projectIdFrom(request.params);
  const parsed = pullSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync pull request"));
  }
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
    return reply.code(403).send(syncAccessProblem());
  }
  const files = (await activeUseCases(useCaseStore, projectId)).map((usecase) => ({
    content: usecaseMarkdown(usecase),
    path: usecasePath(usecase),
    revision: usecase.current_revision_id
  }));
  return reply.send({
    cursor: files[0]?.revision ?? "",
    files
  });
}

async function pushFiles(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const projectId = projectIdFrom(request.params);
  const parsed = pushSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync push request"));
  }
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
    return reply.code(403).send(syncAccessProblem());
  }
  const parseErrors = parsed.data.files.flatMap(parseFileErrors);
  if (parseErrors.length > 0) {
    return reply.code(400).send(parseFilesProblem(parseErrors));
  }
  if (parsed.data.simulate_network_failure) {
    return reply.code(503).send(networkFailureProblem(parsed.data.files));
  }
  const results = parsed.data.dry_run
    ? await Promise.all(
        parsed.data.files.map((file) => previewFile(useCaseStore, projectId, file))
      )
    : await Promise.all(
        parsed.data.files.map((file) =>
          pushFile(branchStore, projectStore, revisionStore, useCaseStore, projectId, file)
        )
      );
  return reply.send({
    cache: { entries: parsed.data.dry_run ? [] : cacheEntries(results) },
    results,
    suggested_next_actions: suggestedSyncActions(results)
  });
}

async function previewFile(
  useCaseStore: UseCaseStore,
  projectId: string,
  file: PushFile
): Promise<SyncResult> {
  const usecase = await usecaseForFile(useCaseStore, projectId, file.path);
  if (usecase === undefined) {
    return { current_revision: "", dry_run: true, path: file.path, status: "SKIPPED" };
  }
  if (file.base_revision !== usecase.current_revision_id) {
    return staleFileConflict(usecase, file);
  }
  return {
    current_revision: usecase.current_revision_id,
    dry_run: true,
    path: file.path,
    status: "OK"
  };
}

async function pushFile(
  branchStore: BranchStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  projectId: string,
  file: PushFile
): Promise<SyncResult> {
  const usecase = await usecaseForFile(useCaseStore, projectId, file.path);
  if (usecase === undefined) {
    return { current_revision: "", path: file.path, status: "SKIPPED" };
  }
  if (file.base_revision !== usecase.current_revision_id) {
    return staleFileConflict(usecase, file);
  }
  const title = titleFrom(file.content);
  const revision = await syncRevision(revisionStore, usecase, title);
  usecase.title = title;
  usecase.current_revision_id = revision.id;
  await useCaseStore.updateUseCase(usecase);
  await revisionStore.saveRevision(revision);
  await advanceMainHead(projectStore, branchStore, projectId, usecase.id, revision.id);
  return { current_revision: revision.id, path: file.path, status: "OK" };
}

async function usecaseForFile(
  useCaseStore: UseCaseStore,
  projectId: string,
  path: string
) {
  return (await activeUseCases(useCaseStore, projectId)).find(
    (candidate) => usecasePath(candidate) === path
  );
}

function syncAccessProblem() {
  return problem(
    403,
    "Not authorized to sync files",
    { exit_code: 3 },
    [
      {
        command: "vspec login",
        reason: "Authenticate before syncing files."
      },
      {
        command: "vspec api-key refresh",
        reason: "Refresh the agent API key if non-interactive auth failed."
      }
    ]
  );
}

async function syncRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase,
  title: string
): Promise<StoredRevision> {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: await revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase, title },
    change_summary: `Synced ${usecase.key} from file`,
    parent_revision_id: usecase.current_revision_id,
    severity: "NON_BREAKING"
  };
}

function projectIdFrom(params: unknown) {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}

async function activeUseCases(useCaseStore: UseCaseStore, projectId: string) {
  return (await useCaseStore.listUseCases(projectId))
    .filter((usecase) => usecase.archived_at === null);
}

async function advanceMainHead(
  projectStore: ProjectStore,
  branchStore: BranchStore,
  projectId: string,
  usecaseId: string,
  revisionId: string
) {
  const project = await projectStore.findProjectById(projectId);
  const branch = project === undefined
    ? undefined
    : await branchStore.findBranchById(project.default_branch_id);
  if (branch !== undefined) {
    branch.head_revision_ids = { ...(branch.head_revision_ids ?? {}), [usecaseId]: revisionId };
    await branchStore.updateBranch(branch);
  }
}
