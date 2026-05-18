import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "./signup-types.js";

const resolutionSchema = z.object({
  entity_id: z.string().min(1),
  field: z.string().optional(),
  strategy: z.enum(["MANUAL", "MINE", "THEIRS"]),
  value: z.unknown().optional()
});
const resolveSchema = z.object({
  base_revision: z.string().min(1),
  resolutions: z.array(resolutionSchema).min(1)
});

export function registerMergeResolveRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/merges/:mergeId/resolve", (request, reply) =>
    resolveMerge(request, reply, state)
  );
}

function resolveMerge(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const merge = state.mergeRequestsById.get(mergeIdFrom(request.params));
  const parsed = resolveSchema.safeParse(request.body);
  if (merge === undefined) {
    return reply.code(404).send(problem(404, "Merge request not found"));
  }
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid merge resolution request"));
  }
  const source = branchById(state, merge.source_branch_id);
  const target = branchById(state, merge.target_branch_id);
  if (source === undefined || target === undefined) {
    return reply.code(404).send(problem(404, "Merge branch not found"));
  }
  if (membershipForProject(request, state, source.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (merge.status !== "OPEN" || merge.conflicts.length === 0) {
    return reply.code(409).send(problem(409, "Merge request has no open conflicts"));
  }
  if (parsed.data.base_revision !== merge.current_revision_id) {
    return reply.code(409).send(
      problem(409, "Merge request base revision is stale", {
        conflicts: merge.conflicts,
        current_revision: merge.current_revision_id
      })
    );
  }

  const newRevisions = resolvedRevisions(state, merge.conflicts, parsed.data.resolutions);
  for (const revision of newRevisions) {
    appendRevision(state, revision);
  }
  target.head_revision_ids = {
    ...(target.head_revision_ids ?? {}),
    ...Object.fromEntries(newRevisions.map((revision) => [revision.entity_id, revision.id]))
  };
  merge.conflicts = [];
  merge.status = "MERGED";
  merge.resolved_at = new Date().toISOString();
  source.status = "MERGED";
  source.merged_at = merge.resolved_at;

  return reply.send({
    main_head_revision_ids: target.head_revision_ids,
    merge_request: merge,
    new_revisions: newRevisions,
    source_branch: source,
    suggested_next_actions: nextActions(state, newRevisions)
  });
}

function resolvedRevisions(
  state: SignupState,
  conflicts: Array<Record<string, unknown>>,
  resolutions: Array<z.infer<typeof resolutionSchema>>
) {
  return conflicts.map((conflict) => {
    const entityId = String(conflict.entity_id);
    const usecase = useCaseById(state, entityId);
    const resolution = resolutions.find((candidate) => candidate.entity_id === entityId);
    const title = resolvedTitle(conflict, resolution);
    if (usecase === undefined || title === undefined) {
      throw new Error("Unsupported conflict resolution");
    }
    usecase.title = title;
    const revision = useCaseRevision(state, usecase);
    usecase.current_revision_id = revision.id;
    return revision;
  });
}

function resolvedTitle(
  conflict: Record<string, unknown>,
  resolution: z.infer<typeof resolutionSchema> | undefined
): string | undefined {
  if (resolution?.strategy === "THEIRS" && typeof conflict.mine_value === "string") {
    return conflict.mine_value;
  }
  if (resolution?.strategy === "MINE" && typeof conflict.theirs_value === "string") {
    return conflict.theirs_value;
  }
  return typeof resolution?.value === "string" ? resolution.value : undefined;
}

function useCaseRevision(state: SignupState, usecase: StoredUseCase): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase },
    change_summary: "Resolved merge conflict",
    severity: "BREAKING"
  };
}

function appendRevision(state: SignupState, revision: StoredRevision) {
  state.revisionsByEntityId.set(revision.entity_id, [
    ...(state.revisionsByEntityId.get(revision.entity_id) ?? []),
    revision
  ]);
}

function nextActions(state: SignupState, revisions: StoredRevision[]) {
  return revisions.map((revision) => ({
    command: `vspec usecase show ${useCaseById(state, revision.entity_id)?.key ?? revision.entity_id}`,
    reason: "Review the resolved use case on main."
  }));
}

function branchById(state: SignupState, branchId: null | string): StoredSpecBranch | undefined {
  return branchId === null ? undefined : state.branchesById.get(branchId);
}

function useCaseById(state: SignupState, usecaseId: string): StoredUseCase | undefined {
  return [...state.usecasesByProjectId.values()]
    .flat()
    .find((usecase) => usecase.id === usecaseId);
}

function mergeIdFrom(params: unknown): string {
  return z.object({ mergeId: z.string().min(1) }).parse(params).mergeId;
}
