import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  startWorkSession, type StartWorkSessionResult
} from "../application/work-session-start.js";
import {
  archivedPinProblem, hardLockedPinProblem, semanticLockProblem
} from "./session-pin-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { StoredSpecBranch, StoredWorkSession } from "../domain/entities/index.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const sessionStartSchema = z.object({
  agent_type: z.string().default("OTHER"),
  auto_branch: z.boolean().default(false),
  branch_name: z.string().min(1).optional(),
  intent: z.string().min(1),
  pins: z.array(z.string().min(1)).min(1),
  project_id: z.string().min(1),
  simulate_write_failure: z.boolean().default(false)
});

export function registerSessionRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/sessions", (request, reply) =>
    startSession(request, reply, {
      branchStore,
      lockStore,
      membershipStore,
      projectStore,
      revisionStore,
      workSessionStore,
      useCaseStore
    }, state)
  );
}

async function startSession(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: Parameters<typeof startWorkSession>[0],
  state: SignupState
) {
  const parsed = sessionStartSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid session request"));
  }

  const result = await startWorkSession(deps, {
    agentIdentifier: agentIdentifier(request, parsed.data.agent_type),
    agentType: parsed.data.agent_type,
    autoBranch: parsed.data.auto_branch,
    branchName: parsed.data.branch_name,
    intent: parsed.data.intent,
    pins: parsed.data.pins,
    projectId: parsed.data.project_id,
    simulateWriteFailure: parsed.data.simulate_write_failure,
    userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
  });

  return sendSessionResult(reply, result);
}

function sendSessionResult(reply: FastifyReply, result: StartWorkSessionResult) {
  switch (result.status) {
    case "ARCHIVED_PIN":
      return reply.code(422).send(archivedPinProblem(result.key));
    case "AUTO_BRANCH_COLLISION":
      return reply.code(409).send(problem(409, "Auto branch name is already in use"));
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
    case "HARD_LOCKED":
      return reply.code(409).send(hardLockedPinProblem(result.key, result.holder));
    case "MISSING_PIN":
      return reply.code(422).send(problem(422, "Pinned use case not found"));
    case "SEMANTIC_LOCKED":
      return reply.code(409).send(semanticLockProblem(result.key, result.holder));
    case "WRITE_FAILURE":
      return reply.code(500).send(writeFailureProblem());
    case "STARTED":
      return reply
        .code(201)
        .send(sessionStartResponse(result.session, result.pinnedKeys, result.warning, result.branch));
  }
}

function sessionStartResponse(
  session: StoredWorkSession,
  keys: string[],
  warning?: { message: string; type: "UNKNOWN_AGENT_TYPE" },
  branch?: StoredSpecBranch
) {
  return {
    session,
    ...(branch === undefined ? {} : { branch }),
    ...(warning === undefined ? {} : { warnings: [warning] }),
    session_file: {
      path: ".vspec/session.json",
      session_id: session.id
    },
    suggested_next_actions: [
      ...keys.map((key) => ({
        command: `vspec usecase show ${key} --session ${session.id}`,
        reason: "Open the pinned use case revision."
      })),
      {
        command: "vspec session complete",
        reason: "Close the session when the work is done."
      }
    ]
  };
}

function writeFailureProblem() {
  return problem(
    500,
    "Session creation failed",
    { created_branch: false, created_session: false },
    [
      {
        command: "vspec session start --retry",
        reason: "Retry after the failed transaction."
      }
    ]
  );
}

function agentIdentifier(request: FastifyRequest, fallback: string): string {
  const header = request.headers["x-vspec-agent"];
  return Array.isArray(header) ? header[0] ?? fallback : header ?? fallback;
}
