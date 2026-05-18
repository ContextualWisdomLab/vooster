import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredProject, StoredWorkSession } from "./signup-types.js";

const sessionListSchema = z.object({
  project_id: z.string().optional(),
  status: z.enum(["ABANDONED", "ACTIVE", "COMPLETED"]).default("ACTIVE"),
  user_id: z.string().optional(),
  workspace_id: z.string().min(1)
});
const heartbeatSchema = z.object({ last_activity_at: z.iso.datetime() });

export function registerSessionListRoutes(app: FastifyInstance, state: SignupState) {
  app.get("/v1/sessions", (request, reply) => listSessions(request, reply, state));
  app.get("/v1/sessions/watch", (request, reply) => watchSessions(request, reply, state));
  app.post("/__test/sessions/:sessionId/heartbeat", (request, reply) =>
    ageSessionHeartbeat(request, reply, state)
  );
}

function listSessions(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const snapshot = sessionSnapshot(request, reply, state);
  return snapshot === undefined ? undefined : reply.send(snapshot);
}

function watchSessions(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const snapshot = sessionSnapshot(request, reply, state);
  if (snapshot === undefined) {
    return undefined;
  }
  return reply
    .header("content-type", "text/event-stream")
    .send(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
}

function sessionSnapshot(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const parsed = sessionListSchema.safeParse(request.query);
  if (!parsed.success) {
    reply.code(400).send(problem(400, "Invalid session list request"));
    return undefined;
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (!hasWorkspaceMembership(state, userId, parsed.data.workspace_id)) {
    reply.code(403).send(
      problem(403, "Workspace membership required", {}, [
        { command: "vspec workspace list", reason: "Choose a workspace you can access." }
      ])
    );
    return undefined;
  }

  const projects = projectsForWorkspace(state, parsed.data.workspace_id);
  const sessions = [...state.workSessionsById.values()]
    .filter((session) => sessionMatches(session, projects, parsed.data))
    .sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""))
    .map((session) => sessionRow(state, session));

  return {
    total: sessions.length,
    sessions,
    summary: {
      total_conflicts: sessions.reduce((total, session) => total + session.conflict_markers.length, 0)
    },
    suggested_next_actions: nextActions(sessions)
  };
}

function ageSessionHeartbeat(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const session = state.workSessionsById.get(sessionIdFrom(request.params));
  const parsed = heartbeatSchema.safeParse(request.body);
  if (session === undefined || !parsed.success) {
    return reply.code(404).send(problem(404, "Session not found"));
  }
  session.last_activity_at = parsed.data.last_activity_at;
  return reply.send({ updated: true });
}

function hasWorkspaceMembership(
  state: SignupState,
  userId: string | undefined,
  workspaceId: string
): boolean {
  return (state.membershipsByUserId.get(userId ?? "") ?? []).some(
    (membership) => membership.workspace_id === workspaceId
  );
}

function projectsForWorkspace(state: SignupState, workspaceId: string): StoredProject[] {
  return [...state.projectsById.values()].filter((project) => project.workspace_id === workspaceId);
}

function sessionMatches(
  session: StoredWorkSession,
  projects: StoredProject[],
  filters: z.infer<typeof sessionListSchema>
): boolean {
  const projectIds = new Set(projects.map((project) => project.id));
  return (
    session.project_id !== undefined &&
    projectIds.has(session.project_id) &&
    session.status === filters.status &&
    (filters.project_id === undefined || session.project_id === filters.project_id) &&
    (filters.user_id === undefined || session.user_id === filters.user_id)
  );
}

function sessionRow(state: SignupState, session: StoredWorkSession) {
  return {
    id: session.id,
    project_id: session.project_id,
    user_id: session.user_id,
    agent_type: session.agent_type,
    agent_identifier: session.agent_identifier,
    intent: session.intent,
    pinned_keys: pinnedKeys(state, session),
    branch_name: branchName(state, session),
    idle_seconds: idleSeconds(session.last_activity_at ?? session.started_at),
    lock_count: lockCount(state, session),
    conflict_markers: conflictMarkers(state, session),
    markers: sessionMarkers(session),
    status: session.status,
    started_at: session.started_at
  };
}

function pinnedKeys(state: SignupState, session: StoredWorkSession): string[] {
  const usecases = state.usecasesByProjectId.get(session.project_id ?? "") ?? [];
  return Object.keys(session.pinned_revisions ?? {}).flatMap((usecaseId) => {
    const usecase = usecases.find((candidate) => candidate.id === usecaseId);
    return usecase === undefined ? [] : [usecase.key];
  });
}

function branchName(state: SignupState, session: StoredWorkSession): null | string {
  return session.branch_id === null || session.branch_id === undefined
    ? null
    : state.branchesById.get(session.branch_id)?.name ?? null;
}

function idleSeconds(startedAt: string | undefined): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(startedAt ?? "")) / 1000));
}

function lockCount(state: SignupState, session: StoredWorkSession): number {
  return [...state.stepLocksByUseCaseId.values()].filter((lock) => lock.holder === session.id).length;
}

function conflictMarkers(state: SignupState, session: StoredWorkSession): string[] {
  const pinned = new Set(Object.keys(session.pinned_revisions ?? {}));
  return [...state.workSessionsById.values()]
    .filter((other) => other.id !== session.id)
    .filter((other) => Object.keys(other.pinned_revisions ?? {}).some((key) => pinned.has(key)))
    .map((other) => `PINNED_BY:${other.id}`);
}

function sessionMarkers(session: StoredWorkSession): string[] {
  return idleSeconds(session.last_activity_at ?? session.started_at) > 1800 ? ["ZOMBIE"] : [];
}

function zombieActions(sessions: Array<{ id: string; markers: string[] }>) {
  return sessions
    .filter((session) => session.markers.includes("ZOMBIE"))
    .map((session) => ({
      command: `vspec session abandon ${session.id}`,
      reason: "Review and explicitly abandon the stale active session."
    }));
}

function nextActions(sessions: Array<{ id: string; markers: string[] }>) {
  return sessions.length === 0
    ? [{ command: "vspec session start --intent \"...\"", reason: "Start a session when work begins." }]
    : zombieActions(sessions);
}

function sessionIdFrom(params: unknown): string {
  return z.object({ sessionId: z.string().min(1) }).parse(params).sessionId;
}
