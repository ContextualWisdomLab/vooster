import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredProject, StoredWorkSession } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const sessionListSchema = z.object({
  project_id: z.string().optional(),
  status: z.enum(["ABANDONED", "ACTIVE", "COMPLETED"]).default("ACTIVE"),
  user_id: z.string().optional(),
  workspace_id: z.string().min(1)
});
const heartbeatSchema = z.object({ last_activity_at: z.iso.datetime() });

export function registerSessionListRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.get("/v1/sessions", (request, reply) =>
    listSessions(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      projectStore,
      workSessionStore,
      useCaseStore
    )
  );
  app.get("/v1/sessions/watch", (request, reply) =>
    watchSessions(
      request,
      reply,
      state,
      branchStore,
      lockStore,
      membershipStore,
      projectStore,
      workSessionStore,
      useCaseStore
    )
  );
  app.post("/__test/sessions/:sessionId/heartbeat", (request, reply) =>
    ageSessionHeartbeat(request, reply, workSessionStore)
  );
}

async function listSessions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const snapshot = await sessionSnapshot(
    request,
    reply,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    workSessionStore,
    useCaseStore
  );
  return snapshot === undefined ? undefined : reply.send(snapshot);
}

async function watchSessions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const snapshot = await sessionSnapshot(
    request,
    reply,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    workSessionStore,
    useCaseStore
  );
  if (snapshot === undefined) {
    return undefined;
  }
  return reply
    .header("content-type", "text/event-stream")
    .send(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
}

async function sessionSnapshot(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = sessionListSchema.safeParse(request.query);
  if (!parsed.success) {
    reply.code(400).send(problem(400, "Invalid session list request"));
    return undefined;
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (!(await hasWorkspaceMembership(membershipStore, userId, parsed.data.workspace_id))) {
    reply.code(403).send(
      problem(403, "Workspace membership required", {}, [
        { command: "vspec workspace list", reason: "Choose a workspace you can access." }
      ])
    );
    return undefined;
  }

  const projects = await projectStore.listProjectsForWorkspace(parsed.data.workspace_id);
  const allSessions = await workSessionStore.listWorkSessions();
  const sessions = await Promise.all(allSessions
    .filter((session) => sessionMatches(session, projects, parsed.data))
    .sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""))
    .map((session) =>
      sessionRow(allSessions, session, branchStore, lockStore, useCaseStore)
    ));

  return {
    total: sessions.length,
    sessions,
    summary: {
      total_conflicts: sessions.reduce((total, session) => total + session.conflict_markers.length, 0)
    },
    suggested_next_actions: nextActions(sessions)
  };
}

async function ageSessionHeartbeat(
  request: FastifyRequest,
  reply: FastifyReply,
  workSessionStore: WorkSessionStore
) {
  const session = await workSessionStore.findWorkSessionById(sessionIdFrom(request.params));
  const parsed = heartbeatSchema.safeParse(request.body);
  if (session === undefined || !parsed.success) {
    return reply.code(404).send(problem(404, "Session not found"));
  }
  session.last_activity_at = parsed.data.last_activity_at;
  await workSessionStore.updateWorkSession(session);
  return reply.send({ updated: true });
}

function hasWorkspaceMembership(
  membershipStore: MembershipStore,
  userId: string | undefined,
  workspaceId: string
): Promise<boolean> {
  return userId === undefined
    ? Promise.resolve(false)
    : membershipStore
        .membershipForWorkspace(workspaceId, userId)
        .then((membership) => membership !== undefined);
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

async function sessionRow(
  allSessions: StoredWorkSession[],
  session: StoredWorkSession,
  branchStore: BranchStore,
  lockStore: LockStore,
  useCaseStore: UseCaseStore
) {
  return {
    id: session.id,
    project_id: session.project_id,
    user_id: session.user_id,
    agent_type: session.agent_type,
    agent_identifier: session.agent_identifier,
    intent: session.intent,
    pinned_keys: await pinnedKeys(session, useCaseStore),
    branch_name: await branchName(branchStore, session),
    idle_seconds: idleSeconds(session.last_activity_at ?? session.started_at),
    lock_count: await lockCount(lockStore, session),
    conflict_markers: conflictMarkers(allSessions, session),
    markers: sessionMarkers(session),
    status: session.status,
    started_at: session.started_at
  };
}

async function pinnedKeys(
  session: StoredWorkSession,
  useCaseStore: UseCaseStore
): Promise<string[]> {
  const usecases =
    session.project_id === undefined
      ? []
      : await useCaseStore.listUseCases(session.project_id);
  return Object.keys(session.pinned_revisions ?? {}).flatMap((usecaseId) => {
    const usecase = usecases.find((candidate) => candidate.id === usecaseId);
    return usecase === undefined ? [] : [usecase.key];
  });
}

async function branchName(
  branchStore: BranchStore,
  session: StoredWorkSession
): Promise<null | string> {
  return session.branch_id === null || session.branch_id === undefined
    ? null
    : (await branchStore.findBranchById(session.branch_id))?.name ?? null;
}

function idleSeconds(startedAt: string | undefined): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(startedAt ?? "")) / 1000));
}

async function lockCount(lockStore: LockStore, session: StoredWorkSession): Promise<number> {
  return (await lockStore.listLocksHeldBySession(session.id)).length;
}

function conflictMarkers(allSessions: StoredWorkSession[], session: StoredWorkSession): string[] {
  const pinned = new Set(Object.keys(session.pinned_revisions ?? {}));
  return allSessions
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
