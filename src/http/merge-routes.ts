import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { StoredMergeRequest } from "./merge-request-types.js";
import type { SignupState, StoredProject, StoredSpecBranch } from "./signup-types.js";

const mergeOpenSchema = z.object({
  source_branch_id: z.string().min(1),
  strategy: z.enum(["FAST_FORWARD", "SQUASH"]).optional(),
  target: z.literal("main").default("main")
});

export function registerMergeRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/merges", (request, reply) => openMerge(request, reply, state));
}

function openMerge(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const parsed = mergeOpenSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid merge request"));
  }
  const source = state.branchesById.get(parsed.data.source_branch_id);
  const project = source === undefined ? undefined : state.projectsById.get(source.project_id);
  if (source === undefined || project === undefined) {
    return reply.code(404).send(problem(404, "Source branch not found"));
  }
  if (membershipForProject(request, state, project.id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const target = state.branchesById.get(project.default_branch_id);
  if (target === undefined || source.status !== "ACTIVE") {
    return reply.code(409).send(problem(409, "Source branch is not active"));
  }
  const targetHeads = mainHeadRevisions(state, project, target);
  const touched = touchedEntityIds(source, targetHeads);
  const hardLock = hardLockConflict(state, touched);
  const conflicts = structuralConflicts(state, source, targetHeads, touched);
  const strategy = conflicts.length === 0 && isFastForward(source, targetHeads, touched)
    ? "FAST_FORWARD"
    : "SQUASH";
  const mergeRequest = mergeRequestFor(request, source, target.id, touched, state, strategy, conflicts);
  state.mergeRequestsById.set(mergeRequest.id, mergeRequest);
  if (hardLock !== undefined) {
    return reply.code(409).send(
      problem(
        409,
        "Target entity has a hard lock",
        { holding_session: hardLock.holder, merge_request: mergeRequest },
        [
          {
            command: `vspec who ${useCaseKey(state, hardLock.usecase_id)}`,
            reason: "Inspect the session holding the hard lock."
          }
        ]
      )
    );
  }
  if (conflicts.length > 0) {
    return reply.code(201).send({
      merge_request: mergeRequest,
      source_branch: source,
      main_head_revision_ids: targetHeads,
      suggested_next_actions: [
        { command: `vspec merge resolve ${mergeRequest.id}`, reason: "Resolve conflicts before this branch can merge." }
      ]
    });
  }
  target.head_revision_ids = {
    ...targetHeads,
    ...Object.fromEntries(touched.map((entityId) => [entityId, source.head_revision_ids?.[entityId] ?? ""]))
  };
  source.status = "MERGED";
  source.merged_at = new Date().toISOString();
  mergeRequest.status = "MERGED";
  mergeRequest.resolved_at = new Date().toISOString();
  return reply.code(201).send({
    merge_request: mergeRequest,
    source_branch: source,
    main_head_revision_ids: target.head_revision_ids,
    suggested_next_actions: [
      { command: `vspec merge show ${mergeRequest.id}`, reason: "Review the completed merge request." }
    ]
  });
}

function mergeRequestFor(
  request: FastifyRequest,
  source: StoredSpecBranch,
  targetBranchId: string,
  touched: string[],
  state: SignupState,
  strategy: "FAST_FORWARD" | "SQUASH",
  conflicts: Array<Record<string, unknown>>
): StoredMergeRequest {
  return {
    id: randomUUID(),
    source_branch_id: source.id,
    target_branch_id: targetBranchId,
    status: "OPEN",
    strategy,
    created_by: membershipForProject(request, state, source.project_id)?.user_id ?? "",
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: Object.fromEntries(touched.map((entityId) => [entityId, severityFor(state, entityId)]))
    },
    conflicts
  };
}

function structuralConflicts(
  state: SignupState,
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  return touched
    .filter((entityId) => source.base_revision_ids?.[entityId] !== targetHeads[entityId])
    .flatMap((entityId) => {
      const mine = titleAtRevision(state, source.head_revision_ids?.[entityId] ?? "");
      const theirs = titleAtRevision(state, targetHeads[entityId] ?? "");
      return mine !== undefined && theirs !== undefined && mine !== theirs
        ? [{
            entity_id: entityId,
            entity_type: "USECASE",
            field: "title",
            mine_value: mine,
            theirs_value: theirs,
            type: "STRUCTURAL"
          }]
        : [];
    });
}

function hardLockConflict(state: SignupState, touched: string[]) {
  return touched
    .map((entityId) => state.stepLocksByUseCaseId.get(entityId))
    .find((lock) => lock?.mode === "HARD");
}

function isFastForward(
  source: StoredSpecBranch,
  targetHeads: Record<string, string>,
  touched: string[]
) {
  return touched.every((entityId) => source.base_revision_ids?.[entityId] === targetHeads[entityId]);
}

function mainHeadRevisions(
  state: SignupState,
  project: StoredProject,
  target: StoredSpecBranch
): Record<string, string> {
  return {
    ...Object.fromEntries(
      (state.usecasesByProjectId.get(project.id) ?? []).map((usecase) => [
        usecase.id,
        usecase.current_revision_id
      ])
    ),
    ...(target.head_revision_ids ?? {})
  };
}

function touchedEntityIds(source: StoredSpecBranch, targetHeads: Record<string, string>) {
  return Object.entries(source.head_revision_ids ?? {})
    .filter(([entityId, revisionId]) => targetHeads[entityId] !== revisionId)
    .map(([entityId]) => entityId);
}

function severityFor(state: SignupState, entityId: string): string {
  return state.revisionsByEntityId.get(entityId)?.at(-1)?.severity ?? "NON_BREAKING";
}

function useCaseKey(state: SignupState, usecaseId: string): string {
  return [...state.usecasesByProjectId.values()]
    .flat()
    .find((usecase) => usecase.id === usecaseId)?.key ?? usecaseId;
}

function titleAtRevision(state: SignupState, revisionId: string): string | undefined {
  const snapshot = [...state.revisionsByEntityId.values()]
    .flat()
    .find((revision) => revision.id === revisionId)?.snapshot;
  return snapshot !== undefined && "title" in snapshot
    ? snapshot.title
    : undefined;
}
