import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { StoredMergeRequest } from "./merge-request-types.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredWorkSession } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";

const completeSchema = z.object({
  no_merge: z.boolean().default(false),
  simulate_conflicts: z.boolean().default(false),
  simulate_completion_failure: z.boolean().default(false),
  simulate_failed_lock_release: z.string().optional(),
  summary: z.string().optional()
});
type MergeRequestResponse = {
  conflicts: unknown[];
  id: string;
};

export function registerSessionCompleteRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore
) {
  app.post("/v1/sessions/:sessionId/complete", (request, reply) =>
    completeSession(request, reply, state, branchStore, membershipStore, mergeRequestStore)
  );
}

async function completeSession(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore
) {
  const session = state.workSessionsById.get(sessionIdFrom(request.params));
  const parsed = completeSchema.safeParse(request.body);
  if (session === undefined) {
    return reply.code(404).send(problem(404, "Session not found"));
  }
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid session completion request"));
  }
  if (!(await canCompleteSession(request, state, membershipStore, session))) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (session.status !== "ACTIVE") {
    return reply.code(409).send(
      problem(
        409,
        "Session is not active",
        { current_status: session.status },
        [
          {
            command: `vspec session show ${session.id}`,
            reason: "Inspect the current session state before retrying."
          }
        ]
      )
    );
  }
  if (parsed.data.simulate_completion_failure) {
    return reply.code(500).send(
      problem(
        500,
        "Session completion failed",
        { exit_code: 5 },
        [{ command: "vspec session complete --retry", reason: "Retry the failed completion." }]
      )
    );
  }

  const lockRelease = releaseSessionLocks(state, session.id, parsed.data.simulate_failed_lock_release);
  session.status = "COMPLETED";
  session.ended_at = new Date().toISOString();
  const mergeRequest = session.branch_id === null || parsed.data.no_merge
    ? undefined
    : openMergeRequest(state, session, parsed.data.simulate_conflicts);
  if (mergeRequest !== undefined) {
    await mergeRequestStore.saveMergeRequest(mergeRequest);
  }
  const noMergeBranch = parsed.data.no_merge
    ? await branchName(branchStore, session)
    : undefined;

  return reply.send({
    session,
    released_lock_ids: lockRelease.releasedLockIds,
    ...(lockRelease.warnings.length === 0 ? {} : { warnings: lockRelease.warnings }),
    ...(mergeRequest === undefined ? {} : { merge_request: mergeRequest }),
    session_file: { path: ".vspec/session.json", cleared: true },
    suggested_next_actions: nextActions(mergeRequest, noMergeBranch)
  });
}

function canCompleteSession(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  session: StoredWorkSession
): Promise<boolean> {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || session.project_id === undefined) {
    return Promise.resolve(false);
  }
  const project = state.projectsById.get(session.project_id);
  if (session.user_id === userId) {
    return Promise.resolve(true);
  }
  if (project === undefined) {
    return Promise.resolve(false);
  }

  return membershipStore
    .membershipForWorkspace(project.workspace_id, userId)
    .then((membership) => membership !== undefined);
}

function releaseSessionLocks(
  state: SignupState,
  sessionId: string,
  failedLockId: string | undefined
) {
  const releasedLockIds: string[] = [];
  const warnings: Array<{ lock_id: string; message: string; type: string }> = [];
  for (const [usecaseId, lock] of state.stepLocksByUseCaseId) {
    if (lock.holder === sessionId) {
      const lockId = lock.id ?? usecaseId;
      if (failedLockId !== undefined && (usecaseId === failedLockId || lock.id === failedLockId)) {
        state.stepLocksByUseCaseId.delete(usecaseId);
        warnings.push({
          lock_id: lockId,
          type: "LOCK_RELEASE_FAILED",
          message: "Lock was already released before completion."
        });
        continue;
      }
      state.stepLocksByUseCaseId.delete(usecaseId);
      releasedLockIds.push(lockId);
    }
  }
  return { releasedLockIds, warnings };
}

function openMergeRequest(
  state: SignupState,
  session: StoredWorkSession,
  withConflicts: boolean
): StoredMergeRequest {
  const project = state.projectsById.get(session.project_id ?? "");
  const conflicts = withConflicts
    ? Object.keys(session.pinned_revisions ?? {}).map((entityId) => ({ entity_id: entityId, type: "SEMANTIC" }))
    : [];
  const mergeRequest: StoredMergeRequest = {
    id: randomUUID(),
    current_revision_id: randomUUID(),
    source_branch_id: session.branch_id ?? null,
    target_branch_id: project?.default_branch_id ?? "",
    status: "OPEN",
    strategy: "FAST_FORWARD",
    created_by: session.user_id ?? "",
    impact: {
      affected_sessions: [],
      affected_branches: [],
      severity_by_entity: Object.fromEntries(
        Object.keys(session.pinned_revisions ?? {}).map((entityId) => [entityId, "NON_BREAKING"])
      )
    },
    conflicts
  };
  return mergeRequest;
}

function nextActions(mergeRequest: MergeRequestResponse | undefined, branch?: string) {
  if (mergeRequest !== undefined) {
    const hasConflicts = mergeRequest.conflicts.length > 0;
    return [
        {
          command: hasConflicts ? `vspec merge resolve ${mergeRequest.id}` : `vspec merge show ${mergeRequest.id}`,
          reason: hasConflicts
            ? "Resolve conflicts before the merge request can be approved."
            : "Review the merge request opened for this completed session."
        }
      ];
  }
  return branch === undefined
    ? []
    : [{ command: `vspec merge open ${branch}`, reason: "Open a merge request for the completed branch later." }];
}

async function branchName(
  branchStore: BranchStore,
  session: StoredWorkSession
): Promise<string | undefined> {
  return session.branch_id === null || session.branch_id === undefined
    ? undefined
    : (await branchStore.findBranchById(session.branch_id))?.name;
}

function sessionIdFrom(params: unknown): string {
  return z.object({ sessionId: z.string().min(1) }).parse(params).sessionId;
}
