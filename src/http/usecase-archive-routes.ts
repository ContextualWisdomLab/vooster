import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerUseCaseArchiveRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  app.delete("/v1/usecases/:usecaseId", (request, reply) =>
    archiveUseCase(
      request,
      reply,
      state,
      branchStore,
      membershipStore,
      projectStore,
      useCaseStore
    )
  );
}

async function archiveUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  const found = await useCaseStore.findUseCaseWithProject(usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (hardDeleteRequested(request.query)) {
    return reply.code(400).send(hardDeleteProblem(found.usecase));
  }
  if (found.usecase.archived_at !== null) {
    return reply.code(409).send(alreadyArchivedProblem(found.usecase));
  }
  const hardLock = activeHardLock(state, found.usecase.id);
  if (hardLock !== undefined) {
    return reply.code(409).send(
      problem(409, "Use case has an active HARD lock", {
        expires_at: hardLock.expires_at,
        holding_session: hardLock.held_by_session_id ?? hardLock.holder
      })
    );
  }

  const archivedAt = new Date().toISOString();
  found.usecase.archived_at = archivedAt;
  const revision = archiveRevision(state, found.usecase);
  found.usecase.current_revision_id = revision.id;
  await useCaseStore.updateUseCase(found.usecase);
  state.revisionsByEntityId.set(found.usecase.id, [
    ...(state.revisionsByEntityId.get(found.usecase.id) ?? []),
    revision
  ]);
  await advanceMainHead(projectStore, branchStore, found.usecase, revision.id);
  const affectedSessions = affectedSessionsFor(state, found.usecase.id);

  return reply.send({
    active_locks_count: activeLockCount(state, found.usecase.id),
    affected_sessions: affectedSessions,
    affected_sessions_count: affectedSessions.length,
    revision: { change_summary: revision.change_summary, id: revision.id },
    suggested_next_actions: [
      {
        command: `vspec usecase restore ${found.usecase.key}`,
        reason: "Restore the use case if it returns to scope."
      }
    ],
    usecase: {
      archived_at: archivedAt,
      id: found.usecase.id,
      key: found.usecase.key
    }
  });
}

export async function restoreArchivedUseCase(
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore,
  found: { projectId: string; usecase: StoredUseCase }
) {
  if (found.usecase.archived_at === null) {
    return reply.code(409).send(problem(409, "Use case is not archived"));
  }
  found.usecase.archived_at = null;
  const revision = restoreRevision(state, found.usecase);
  found.usecase.current_revision_id = revision.id;
  await useCaseStore.updateUseCase(found.usecase);
  state.revisionsByEntityId.set(found.usecase.id, [
    ...(state.revisionsByEntityId.get(found.usecase.id) ?? []),
    revision
  ]);
  await advanceMainHead(projectStore, branchStore, found.usecase, revision.id);
  return reply.send({
    revision: { change_summary: revision.change_summary, id: revision.id },
    usecase: { archived_at: null, id: found.usecase.id, key: found.usecase.key }
  });
}

function archiveRevision(state: SignupState, usecase: StoredUseCase): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase },
    change_summary: `Archived use case ${usecase.key}`
  };
}

function restoreRevision(state: SignupState, usecase: StoredUseCase): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase },
    change_summary: `Restored use case ${usecase.key}`
  };
}

function hardDeleteProblem(usecase: StoredUseCase) {
  return problem(
    400,
    "Destructive deletion is post-MVP",
    { destructive_delete: true },
    [
      {
        command: `vspec usecase archive ${usecase.key}`,
        reason: "Archive is the supported reversible removal path."
      }
    ]
  );
}

function alreadyArchivedProblem(usecase: StoredUseCase) {
  return problem(
    409,
    "Use case is already archived",
    { archived_at: usecase.archived_at },
    [
      {
        command: `vspec usecase restore ${usecase.key}`,
        reason: "Restore the archived use case instead."
      }
    ]
  );
}

function hardDeleteRequested(query: unknown): boolean {
  const parsed = z.object({
    hard: z.literal("true").optional(),
    purge: z.literal("true").optional()
  }).safeParse(query);
  return parsed.success && (parsed.data.hard === "true" || parsed.data.purge === "true");
}

async function advanceMainHead(
  projectStore: ProjectStore,
  branchStore: BranchStore,
  usecase: StoredUseCase,
  revisionId: string
) {
  const project = await projectStore.findProjectById(usecase.project_id);
  const main = project === undefined
    ? undefined
    : await branchStore.findBranchById(project.default_branch_id);
  if (main !== undefined) {
    main.head_revision_ids = { ...(main.head_revision_ids ?? {}), [usecase.id]: revisionId };
    await branchStore.updateBranch(main);
  }
}

function activeLockCount(state: SignupState, usecaseId: string) {
  const lock = state.stepLocksByUseCaseId.get(usecaseId);
  return lock !== undefined && Date.parse(lock.expires_at) > Date.now() ? 1 : 0;
}

function activeHardLock(state: SignupState, usecaseId: string) {
  const lock = state.stepLocksByUseCaseId.get(usecaseId);
  return lock?.mode === "HARD" && Date.parse(lock.expires_at) > Date.now()
    ? lock
    : undefined;
}

function affectedSessionsFor(state: SignupState, usecaseId: string) {
  return (state.workSessionsByUseCaseId.get(usecaseId) ?? [])
    .filter((session) => session.status === "ACTIVE")
    .map((session) => ({
      id: session.id,
      pinned_revision: session.pinned_revisions?.[usecaseId] ?? session.pinned_revision_id ?? ""
    }));
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
