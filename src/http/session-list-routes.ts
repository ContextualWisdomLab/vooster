import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { listSessionSnapshot } from "../application/session-list.js";
import {
  sendSessionListResult, sessionListEvent, workspaceMembershipProblem
} from "./session-list-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
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

type SessionRouteDeps = {
  branchStore: BranchStore;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

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
  const deps = {
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    useCaseStore,
    workSessionStore
  };
  app.get("/v1/sessions", (request, reply) =>
    listSessions(request, reply, state, deps)
  );
  app.get("/v1/sessions/watch", (request, reply) =>
    watchSessions(request, reply, state, deps)
  );
  app.post("/__test/sessions/:sessionId/heartbeat", (request, reply) =>
    ageSessionHeartbeat(request, reply, workSessionStore)
  );
}

async function listSessions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: SessionRouteDeps
) {
  const result = await sessionSnapshot(request, reply, state, deps);
  return result === undefined ? undefined : sendSessionListResult(reply, result);
}

async function watchSessions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: SessionRouteDeps
) {
  const result = await sessionSnapshot(request, reply, state, deps);
  if (result === undefined) {
    return undefined;
  }
  if (result.status === "FORBIDDEN") {
    return reply.code(403).send(workspaceMembershipProblem());
  }
  return reply
    .header("content-type", "text/event-stream")
    .send(sessionListEvent(result));
}

async function sessionSnapshot(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: SessionRouteDeps
) {
  const parsed = sessionListSchema.safeParse(request.query);
  if (!parsed.success) {
    reply.code(400).send(problem(400, "Invalid session list request"));
    return undefined;
  }
  return listSessionSnapshot(
    deps,
    {
      projectId: parsed.data.project_id,
      status: parsed.data.status,
      targetUserId: parsed.data.user_id,
      userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken),
      workspaceId: parsed.data.workspace_id
    }
  );
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

function sessionIdFrom(params: unknown): string {
  return z.object({ sessionId: z.string().min(1) }).parse(params).sessionId;
}
