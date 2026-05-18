import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredWorkSession } from "./signup-types.js";

const completeSchema = z.object({
  no_merge: z.boolean().default(false),
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

  const releasedLockIds = releaseSessionLocks(state, session.id);
  session.status = "COMPLETED";
  session.ended_at = new Date().toISOString();
  const mergeRequest = session.branch_id === null || parsed.data.no_merge
    ? undefined
    : openMergeRequest(state, session);

  return reply.send({
    session,
    released_lock_ids: releasedLockIds,
    ...(mergeRequest === undefined ? {} : { merge_request: mergeRequest }),
    session_file: { path: ".vspec/session.json", cleared: true },
    suggested_next_actions: nextActions(mergeRequest)
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

function nextActions(mergeRequest: { id: string } | undefined) {
  return mergeRequest === undefined
    ? []
    : [
        {
          command: `vspec merge show ${mergeRequest.id}`,
          reason: "Review the merge request opened for this completed session."
        }
      ];
}

function sessionIdFrom(params: unknown): string {
  return z.object({ sessionId: z.string().min(1) }).parse(params).sessionId;
}
