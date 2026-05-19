import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hardLockConflict, mergeConflicts, useCaseKey } from "./merge-conflict-support.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { StoredMergeRequest } from "./merge-request-types.js";
import type { SignupState, StoredProject, StoredSpecBranch } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

const mergeOpenSchema = z.object({
  simulate_write_failure: z.boolean().default(false),
  source_branch_id: z.string().min(1),
  strategy: z.enum(["FAST_FORWARD", "SQUASH"]).optional(),
  target: z.literal("main").default("main")
});

export function registerMergeRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore
) {
  app.post("/v1/merges", (request, reply) =>
    openMerge(request, reply, state, branchStore, membershipStore)
  );
}

async function openMerge(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore
) {
  const parsed = mergeOpenSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid merge request"));
  }
  const source = await branchStore.findBranchById(parsed.data.source_branch_id);
  const project = source === undefined ? undefined : state.projectsById.get(source.project_id);
  if (source === undefined || project === undefined) {
    return reply.code(404).send(problem(404, "Source branch not found"));
  }
  const membership = await membershipForProject(request, state, membershipStore, project.id);
  if (membership === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const target = await branchStore.findBranchById(project.default_branch_id);
  if (target === undefined || source.status !== "ACTIVE") {
    return reply.code(409).send(problem(409, "Source branch is not active"));
  }
  const targetHeads = mainHeadRevisions(state, project, target);
  const touched = touchedEntityIds(source, targetHeads);
  const hardLock = hardLockConflict(state, touched);
  const conflicts = mergeConflicts(state, source, targetHeads, touched);
  const canFastForward = isFastForward(source, targetHeads, touched);
  if (parsed.data.strategy === "FAST_FORWARD" && !canFastForward) {
    return reply.code(422).send(
      problem(
        422,
        "Fast-forward rejected because main has advanced",
        { main_head_revision_ids: targetHeads, source_branch: source },
        [
          {
            command: `vspec merge open ${source.name} --strategy squash`,
            reason: "Retry with the safe squash strategy."
          }
        ]
      )
    );
  }
  const strategy = conflicts.length === 0 && canFastForward ? "FAST_FORWARD" : "SQUASH";
  const mergeRequest = mergeRequestFor(
    membership.user_id,
    source,
    target.id,
    touched,
    state,
    strategy,
    conflicts
  );
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
  if (parsed.data.simulate_write_failure) {
    return reply.code(500).send(
      problem(
        500,
        "Merge write failed",
        {
          exit_code: 5,
          main_head_revision_ids: targetHeads,
          merge_request: mergeRequest,
          source_branch: source
        },
        [
          {
            command: `vspec merge open ${source.name} --retry`,
            reason: "Retry after the failed merge write."
          }
        ]
      )
    );
  }
  target.head_revision_ids = {
    ...targetHeads,
    ...Object.fromEntries(touched.map((entityId) => [entityId, source.head_revision_ids?.[entityId] ?? ""]))
  };
  source.status = "MERGED";
  source.merged_at = new Date().toISOString();
  await branchStore.updateBranch(target);
  await branchStore.updateBranch(source);
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
  createdBy: string,
  source: StoredSpecBranch,
  targetBranchId: string,
  touched: string[],
  state: SignupState,
  strategy: "FAST_FORWARD" | "SQUASH",
  conflicts: Array<Record<string, unknown>>
): StoredMergeRequest {
  return {
    id: randomUUID(),
    current_revision_id: randomUUID(),
    source_branch_id: source.id,
    target_branch_id: targetBranchId,
    status: "OPEN",
    strategy,
    created_by: createdBy,
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity_by_entity: Object.fromEntries(touched.map((entityId) => [entityId, severityFor(state, entityId)]))
    },
    conflicts
  };
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
