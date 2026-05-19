import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { hardLockConflict } from "./merge-conflict-support.js";
import {
  hardLockResolutionProblem,
  missingManualValueProblem,
  manualResolutionMissingValue,
  resolutionWriteFailureProblem,
  staleBaseProblem,
  uncoveredConflictsProblem,
  uncoveredConflicts
} from "./merge-resolve-validation.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const resolutionSchema = z.object({
  entity_id: z.string().min(1),
  field: z.string().optional(),
  strategy: z.enum(["MANUAL", "MINE", "THEIRS"]),
  value: z.unknown().optional()
});
const resolveSchema = z.object({
  base_revision: z.string().min(1),
  resolutions: z.array(resolutionSchema).min(1),
  simulate_write_failure: z.boolean().default(false)
});

export function registerMergeResolveRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/merges/:mergeId/resolve", (request, reply) =>
    resolveMerge(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      mergeRequestStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function resolveMerge(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const merge = await mergeRequestStore.findMergeRequestById(mergeIdFrom(request.params));
  const parsed = resolveSchema.safeParse(request.body);
  if (merge === undefined) {
    return reply.code(404).send(problem(404, "Merge request not found"));
  }
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid merge resolution request"));
  }
  const source = await branchById(branchStore, merge.source_branch_id);
  const target = await branchById(branchStore, merge.target_branch_id);
  if (source === undefined || target === undefined) {
    return reply.code(404).send(problem(404, "Merge branch not found"));
  }
  if (await membershipForProject(request, state, membershipStore, source.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (merge.status !== "OPEN" || merge.conflicts.length === 0) {
    return reply.code(409).send(problem(409, "Merge request has no open conflicts"));
  }
  if (parsed.data.base_revision !== merge.current_revision_id) {
    return reply.code(409).send(staleBaseProblem(merge));
  }
  const missingManualValue = manualResolutionMissingValue(parsed.data.resolutions);
  if (missingManualValue !== undefined) {
    return reply.code(400).send(missingManualValueProblem(merge, missingManualValue));
  }
  const uncovered = uncoveredConflicts(merge.conflicts, parsed.data.resolutions);
  if (uncovered.length > 0) {
    return reply.code(422).send(uncoveredConflictsProblem(merge, uncovered));
  }
  const hardLock = await hardLockConflict(
    lockStore,
    merge.conflicts.map((conflict) => String(conflict.entity_id))
  );
  if (hardLock !== undefined) {
    return reply
      .code(409)
      .send(await hardLockResolutionProblem(
        state,
        useCaseStore,
        merge,
        target.head_revision_ids ?? {},
        hardLock
      ));
  }
  if (parsed.data.simulate_write_failure) {
    return reply
      .code(500)
      .send(resolutionWriteFailureProblem(merge, source, target.head_revision_ids ?? {}));
  }
  const newRevisions = await resolvedRevisions(
    revisionStore,
    useCaseStore,
    merge.conflicts,
    parsed.data.resolutions
  );
  for (const revision of newRevisions) {
    await revisionStore.saveRevision(revision);
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
  await branchStore.updateBranch(target);
  await branchStore.updateBranch(source);
  await mergeRequestStore.updateMergeRequest(merge);
  return reply.send({
    main_head_revision_ids: target.head_revision_ids,
    merge_request: merge,
    new_revisions: newRevisions,
    source_branch: source,
    suggested_next_actions: await nextActions(useCaseStore, newRevisions)
  });
}

async function resolvedRevisions(
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore,
  conflicts: Array<Record<string, unknown>>,
  resolutions: Array<z.infer<typeof resolutionSchema>>
): Promise<StoredRevision[]> {
  return Promise.all(conflicts.map(async (conflict) => {
    const entityId = String(conflict.entity_id);
    const usecase = (await useCaseStore.findUseCaseWithProject(entityId))?.usecase;
    const resolution = resolutions.find((candidate) => candidate.entity_id === entityId);
    const title = resolvedTitle(conflict, resolution);
    if (usecase === undefined || title === undefined) {
      throw new Error("Unsupported conflict resolution");
    }
    usecase.title = title;
    const revision = await useCaseRevision(revisionStore, usecase);
    usecase.current_revision_id = revision.id;
    await useCaseStore.updateUseCase(usecase);
    return revision;
  }));
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

async function useCaseRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase
): Promise<StoredRevision> {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: await revisionStore.nextVersionNumber(usecase.id),
    snapshot: { ...usecase },
    change_summary: "Resolved merge conflict",
    severity: "BREAKING"
  };
}

async function nextActions(useCaseStore: UseCaseStore, revisions: StoredRevision[]) {
  return Promise.all(revisions.map(async (revision) => ({
    command: `vspec usecase show ${
      (await useCaseStore.findUseCaseWithProject(revision.entity_id))?.usecase.key ??
        revision.entity_id
    }`,
    reason: "Review the resolved use case on main."
  })));
}

function branchById(branchStore: BranchStore, branchId: null | string) {
  return branchId === null ? Promise.resolve(undefined) : branchStore.findBranchById(branchId);
}

function mergeIdFrom(params: unknown): string {
  return z.object({ mergeId: z.string().min(1) }).parse(params).mergeId;
}
