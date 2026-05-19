import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { StoredMergeRequest } from "./merge-request-types.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredLock,
  StoredUseCase,
  StoredWorkSession
} from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

export function registerWhoRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore
) {
  app.get("/v1/usecases/:usecaseId/who", (request, reply) =>
    showWho(request, reply, state, branchStore, membershipStore)
  );
}

async function showWho(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore
) {
  const usecaseId = usecaseIdFrom(request.params);
  const usecase = useCaseById(state, usecaseId);
  if (usecase === undefined) {
    return reply.code(404).send(missingUseCaseProblem(usecaseId));
  }
  if (await membershipForProject(request, state, membershipStore, usecase.project_id) === undefined) {
    return reply.code(403).send(workspaceMembershipProblem());
  }

  const sessions = activeSessions(state, usecase.id).map(sessionRow);
  const locks = activeLocks(state, usecase.id).map(lockRow);
  const mergeRequests = (await openMergeRequests(state, branchStore, usecase.id)).map(mergeRow);
  const hasActiveWork = sessions.length + locks.length + mergeRequests.length > 0;
  return reply.send({
    ...(usecase.archived_at === null ? {} : { archived: true }),
    locks,
    merge_requests: mergeRequests,
    sessions,
    suggested_next_actions: nextActions(locks, mergeRequests, usecase, hasActiveWork, sessions),
    usecase: { id: usecase.id, key: usecase.key }
  });
}

function missingUseCaseProblem(usecaseId: string) {
  return problem(
    404,
    "Use case not found",
    { key_format: "KEY-NNN" },
    [
      {
        command: `vspec usecase search ${usecaseId}`,
        reason: "Search for the intended use case key."
      }
    ]
  );
}

function workspaceMembershipProblem() {
  return problem(
    403,
    "Workspace membership required",
    {},
    [
      {
        command: "vspec workspace list",
        reason: "Choose a workspace you can access."
      }
    ]
  );
}

function activeSessions(state: SignupState, usecaseId: string) {
  return (state.workSessionsByUseCaseId.get(usecaseId) ?? [])
    .filter((session) => session.status === "ACTIVE")
    .filter((session) => session.pinned_revisions?.[usecaseId] !== undefined);
}

function activeLocks(state: SignupState, usecaseId: string) {
  const lock = state.stepLocksByUseCaseId.get(usecaseId);
  return lock === undefined || Date.parse(lock.expires_at) <= Date.now() ? [] : [lock];
}

async function openMergeRequests(
  state: SignupState,
  branchStore: BranchStore,
  usecaseId: string
) {
  const matches = await Promise.all([...state.mergeRequestsById.values()]
    .filter((merge) => merge.status === "OPEN")
    .map(async (merge) => ({
      merge,
      touches: await branchTouches(branchStore, merge.source_branch_id, usecaseId) ||
        await branchTouches(branchStore, merge.target_branch_id, usecaseId)
    })));
  return matches.filter((match) => match.touches).map((match) => match.merge);
}

function sessionRow(session: StoredWorkSession) {
  return {
    agent_type: session.agent_type,
    id: session.id,
    intent: session.intent,
    markers: sessionMarkers(session),
    started_at: session.started_at,
    user_id: session.user_id
  };
}

function lockRow(lock: StoredLock) {
  return {
    expires_at: lock.expires_at,
    held_by_session_id: lock.held_by_session_id ?? null,
    held_by_user_id: lock.held_by_user_id ?? "",
    id: lock.id ?? lock.usecase_id,
    lock_type: lock.lock_type ?? lock.mode
  };
}

function mergeRow(merge: StoredMergeRequest) {
  return {
    conflict_count: merge.conflicts.length,
    id: merge.id,
    source_branch_id: merge.source_branch_id,
    status: merge.status
  };
}

function nextActions(
  locks: ReturnType<typeof lockRow>[],
  merges: Array<ReturnType<typeof mergeRow>>,
  usecase: StoredUseCase,
  hasActiveWork: boolean,
  sessions: Array<ReturnType<typeof sessionRow>>
) {
  if (!hasActiveWork) {
    return [
      {
        command: `vspec session start --intent "..." --pin ${usecase.key}`,
        reason: "Start a session on this use case."
      }
    ];
  }
  return [
    ...(
      usecase.archived_at !== null
        ? [{
            command: `vspec usecase restore ${usecase.key}`,
            reason: "Restore the archived use case before coordinating active work."
          }]
        : []
    ),
    ...(
      locks.length === 0
        ? []
        : [{ command: "vspec lock list", reason: "Review active locks before editing." }]
    ),
    ...merges.map((merge) => ({
      command: `vspec merge show ${merge.id}`,
      reason: "Review the open merge request touching this use case."
    })),
    ...sessions
      .filter((session) => session.markers.includes("ZOMBIE"))
      .map((session) => ({
        command: `vspec session abandon ${session.id}`,
        reason: "Review and explicitly abandon the stale active session."
      }))
  ];
}

function sessionMarkers(session: StoredWorkSession): string[] {
  return idleSeconds(session.last_activity_at ?? session.started_at) > 1800 ? ["ZOMBIE"] : [];
}

function idleSeconds(startedAt: string | undefined): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(startedAt ?? "")) / 1000));
}

async function branchTouches(
  branchStore: BranchStore,
  branchId: null | string,
  usecaseId: string
): Promise<boolean> {
  return branchId !== null &&
    (await branchStore.findBranchById(branchId))?.head_revision_ids?.[usecaseId] !== undefined;
}

function useCaseById(state: SignupState, usecaseId: string): StoredUseCase | undefined {
  return [...state.usecasesByProjectId.values()]
    .flat()
    .find((usecase) => usecase.id === usecaseId);
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
