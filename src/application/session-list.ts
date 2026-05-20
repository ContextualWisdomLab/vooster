import type {
  StoredProject,
  StoredWorkSession
} from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type SessionListDeps = {
  branchStore: BranchStore;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  now?: () => Date;
  projectStore: ProjectStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type SessionListInput = {
  projectId: string | undefined;
  status: StoredWorkSession["status"];
  targetUserId: string | undefined;
  userId: string | undefined;
  workspaceId: string;
};

export type SessionListRow = {
  agent_identifier?: string;
  agent_type?: StoredWorkSession["agent_type"];
  branch_name: null | string;
  conflict_markers: string[];
  id: string;
  idle_seconds: number;
  intent?: string;
  lock_count: number;
  markers: string[];
  pinned_keys: string[];
  project_id?: string;
  started_at?: string;
  status: StoredWorkSession["status"];
  user_id?: string;
};

export type SessionSnapshot = {
  sessions: SessionListRow[];
  summary: { total_conflicts: number };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  total: number;
};

export type SessionListResult =
  | { snapshot: SessionSnapshot; status: "LISTED" }
  | { status: "FORBIDDEN" };

export async function listSessionSnapshot(
  deps: SessionListDeps,
  input: SessionListInput
): Promise<SessionListResult> {
  if (!(await hasWorkspaceMembership(deps.membershipStore, input.userId, input.workspaceId))) {
    return { status: "FORBIDDEN" };
  }

  const projects = await deps.projectStore.listProjectsForWorkspace(input.workspaceId);
  const allSessions = await deps.workSessionStore.listWorkSessions();
  const matchingSessions = allSessions
    .filter((session) => sessionMatches(session, projects, input))
    .sort((left, right) => (right.started_at ?? "").localeCompare(left.started_at ?? ""));
  const sessions = await Promise.all(matchingSessions
    .map((session) => sessionRow(deps, matchingSessions, session)));

  return {
    snapshot: {
      sessions,
      summary: {
        total_conflicts: sessions.reduce(
          (total, session) => total + session.conflict_markers.length,
          0
        )
      },
      suggested_next_actions: nextActions(sessions),
      total: sessions.length
    },
    status: "LISTED"
  };
}

async function hasWorkspaceMembership(
  membershipStore: MembershipStore,
  userId: string | undefined,
  workspaceId: string
): Promise<boolean> {
  return userId !== undefined &&
    await membershipStore.membershipForWorkspace(workspaceId, userId) !== undefined;
}

function sessionMatches(
  session: StoredWorkSession,
  projects: StoredProject[],
  filters: SessionListInput
): boolean {
  const projectIds = new Set(projects.map((project) => project.id));
  return (
    session.project_id !== undefined &&
    projectIds.has(session.project_id) &&
    session.status === filters.status &&
    (filters.projectId === undefined || session.project_id === filters.projectId) &&
    (filters.targetUserId === undefined || session.user_id === filters.targetUserId)
  );
}

async function sessionRow(
  deps: SessionListDeps,
  allSessions: StoredWorkSession[],
  session: StoredWorkSession
): Promise<SessionListRow> {
  return {
    agent_identifier: session.agent_identifier,
    agent_type: session.agent_type,
    branch_name: await branchName(deps.branchStore, session),
    conflict_markers: conflictMarkers(allSessions, session),
    id: session.id,
    idle_seconds: idleSeconds(deps, session.last_activity_at ?? session.started_at),
    intent: session.intent,
    lock_count: await lockCount(deps.lockStore, session),
    markers: sessionMarkers(deps, session),
    pinned_keys: await pinnedKeys(session, deps.useCaseStore),
    project_id: session.project_id,
    started_at: session.started_at,
    status: session.status,
    user_id: session.user_id
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

function idleSeconds(deps: SessionListDeps, startedAt: string | undefined): number {
  return Math.max(0, Math.floor((now(deps).getTime() - Date.parse(startedAt ?? "")) / 1000));
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

function sessionMarkers(deps: SessionListDeps, session: StoredWorkSession): string[] {
  return idleSeconds(deps, session.last_activity_at ?? session.started_at) > 1800
    ? ["ZOMBIE"]
    : [];
}

function nextActions(sessions: SessionListRow[]) {
  return sessions.length === 0
    ? [{ command: "vspec session start --intent \"...\"", reason: "Start a session when work begins." }]
    : sessions
        .filter((session) => session.markers.includes("ZOMBIE"))
        .map((session) => ({
          command: `vspec session abandon ${session.id}`,
          reason: "Review and explicitly abandon the stale active session."
        }));
}

function now(deps: SessionListDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
