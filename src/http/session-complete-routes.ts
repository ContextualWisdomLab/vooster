import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredWorkSession } from "./signup-types.js";

const completeSchema = z.object({
  no_merge: z.boolean().default(false),
  simulate_completion_failure: z.boolean().default(false),
  summary: z.string().optional()
});

export function registerSessionCompleteRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/sessions/:sessionId/complete", (request, reply) =>
    completeSession(request, reply, state)
  );
}

function completeSession(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const session = state.workSessionsById.get(sessionIdFrom(request.params));
  const parsed = completeSchema.safeParse(request.body);
  if (session === undefined) {
    return reply.code(404).send(problem(404, "Session not found"));
  }
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid session completion request"));
  }
  if (!canCompleteSession(request, state, session)) {
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

  const releasedLockIds = releaseSessionLocks(state, session.id);
  session.status = "COMPLETED";
  session.ended_at = new Date().toISOString();
  const mergeRequest = session.branch_id === null || parsed.data.no_merge
    ? undefined
    : openMergeRequest(state, session);
  const noMergeBranch = parsed.data.no_merge ? branchName(state, session) : undefined;

  return reply.send({
    session,
    released_lock_ids: releasedLockIds,
    ...(mergeRequest === undefined ? {} : { merge_request: mergeRequest }),
    session_file: { path: ".vspec/session.json", cleared: true },
    suggested_next_actions: nextActions(mergeRequest, noMergeBranch)
  });
}

function canCompleteSession(
  request: FastifyRequest,
  state: SignupState,
  session: StoredWorkSession
): boolean {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || session.project_id === undefined) {
    return false;
  }
  const project = state.projectsById.get(session.project_id);
  return (
    session.user_id === userId ||
    (state.membershipsByUserId.get(userId) ?? []).some(
      (membership) => membership.workspace_id === project?.workspace_id
    )
  );
}

function releaseSessionLocks(state: SignupState, sessionId: string): string[] {
  const released: string[] = [];
  for (const [usecaseId, lock] of state.stepLocksByUseCaseId) {
    if (lock.holder === sessionId) {
      state.stepLocksByUseCaseId.delete(usecaseId);
      released.push(usecaseId);
    }
  }
  return released;
}

function openMergeRequest(state: SignupState, session: StoredWorkSession) {
  const project = state.projectsById.get(session.project_id ?? "");
  return {
    id: randomUUID(),
    source_branch_id: session.branch_id,
    target_branch_id: project?.default_branch_id ?? "",
    status: "OPEN",
    strategy: "FAST_FORWARD",
    impact: {
      affected_sessions: [],
      affected_branches: [],
      severity_by_entity: Object.fromEntries(
        Object.keys(session.pinned_revisions ?? {}).map((entityId) => [entityId, "NON_BREAKING"])
      )
    },
    conflicts: []
  };
}

function nextActions(mergeRequest: { id: string } | undefined, branch?: string) {
  if (mergeRequest !== undefined) {
    return [
        {
          command: `vspec merge show ${mergeRequest.id}`,
          reason: "Review the merge request opened for this completed session."
        }
      ];
  }
  return branch === undefined
    ? []
    : [{ command: `vspec merge open ${branch}`, reason: "Open a merge request for the completed branch later." }];
}

function branchName(state: SignupState, session: StoredWorkSession): string | undefined {
  return session.branch_id === null || session.branch_id === undefined
    ? undefined
    : state.branchesById.get(session.branch_id)?.name;
}

function sessionIdFrom(params: unknown): string {
  return z.object({ sessionId: z.string().min(1) }).parse(params).sessionId;
}
