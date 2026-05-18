import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createAutoBranch } from "./session-branch-support.js";
import {
  archivedPinProblem,
  hardLockedPinProblem,
  resolvePins,
  semanticLockConflict,
  semanticLockProblem,
  type PinnedUseCases
} from "./session-pin-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredAgentType,
  StoredSpecBranch,
  StoredMembership,
  StoredWorkSession
} from "./signup-types.js";

const knownAgentTypes = new Set<StoredAgentType>([
  "CLAUDE_CODE",
  "CODEX",
  "CURSOR",
  "HUMAN",
  "OTHER",
  "WINDSURF"
]);
const sessionStartSchema = z.object({
  agent_type: z.string().default("OTHER"),
  auto_branch: z.boolean().default(false),
  branch_name: z.string().min(1).optional(),
  intent: z.string().min(1),
  pins: z.array(z.string().min(1)).min(1),
  project_id: z.string().min(1),
  simulate_write_failure: z.boolean().default(false)
});

export function registerSessionRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/sessions", (request, reply) => startSession(request, reply, state));
}

function startSession(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const parsed = sessionStartSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid session request"));
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (membershipForProject(state, userId, parsed.data.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const pinned = resolvePins(state, parsed.data.project_id, parsed.data.pins);
  if (pinned.status === "ARCHIVED") {
    return reply.code(422).send(archivedPinProblem(pinned.key));
  }
  if (pinned.status === "HARD_LOCKED") {
    return reply.code(409).send(hardLockedPinProblem(pinned.key, pinned.holder));
  }
  if (pinned.status !== "OK") {
    return reply.code(422).send(problem(422, "Pinned use case not found"));
  }
  const semanticConflict = parsed.data.auto_branch
    ? semanticLockConflict(state, pinned)
    : undefined;
  if (semanticConflict !== undefined) {
    return reply
      .code(409)
      .send(semanticLockProblem(semanticConflict.key, semanticConflict.holder));
  }
  if (parsed.data.simulate_write_failure) {
    return reply.code(500).send(problem(500, "Session creation failed", { created_branch: false, created_session: false }, [{ command: "vspec session start --retry", reason: "Retry after the failed transaction." }]));
  }
  return createPinnedSession(request, reply, state, parsed.data, pinned, userId ?? "");
}

function createPinnedSession(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  data: z.infer<typeof sessionStartSchema>,
  pinned: PinnedUseCases,
  userId: string
) {
  const session = workSession(data, pinned, userId, agentIdentifier(request, data.agent_type));
  const branch = data.auto_branch
    ? createAutoBranch(state, data.project_id, data.branch_name ?? `agent/${session.id}`, session)
    : undefined;
  if (branch === undefined && data.auto_branch) {
    return reply.code(409).send(problem(409, "Auto branch name is already in use"));
  }
  session.branch_id = branch?.id ?? null;
  state.workSessionsById.set(session.id, session);
  for (const usecase of pinned.usecases) {
    const sessions = state.workSessionsByUseCaseId.get(usecase.id) ?? [];
    state.workSessionsByUseCaseId.set(usecase.id, [...sessions, session]);
  }

  return reply
    .code(201)
    .send(sessionStartResponse(session, pinned.keys, data.agent_type, branch));
}

function workSession(
  data: z.infer<typeof sessionStartSchema>,
  pinned: PinnedUseCases,
  userId: string,
  agentIdentifier: string
): StoredWorkSession {
  const agentType = agentTypeFor(data.agent_type);
  return {
    id: randomUUID(),
    project_id: data.project_id,
    user_id: userId,
    agent_type: agentType,
    agent_identifier: agentType === "OTHER" ? data.agent_type : agentIdentifier,
    intent: data.intent,
    pinned_revisions: pinned.revisions,
    branch_id: null,
    status: "ACTIVE",
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString()
  };
}

function sessionStartResponse(
  session: StoredWorkSession,
  keys: string[],
  rawAgentType: string,
  branch?: StoredSpecBranch
) {
  return {
    session,
    ...(branch === undefined ? {} : { branch }),
    ...unknownAgentWarning(rawAgentType),
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

function unknownAgentWarning(rawAgentType: string) {
  return knownAgentTypes.has(rawAgentType as StoredAgentType)
    ? {}
    : {
        warnings: [
          {
            type: "UNKNOWN_AGENT_TYPE",
            message: `Stored unrecognized agent_type ${rawAgentType} as OTHER.`
          }
        ]
      };
}

function membershipForProject(
  state: SignupState,
  userId: string | undefined,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  if (project === undefined || userId === undefined) {
    return undefined;
  }

  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}

function agentIdentifier(request: FastifyRequest, fallback: string): string {
  const header = request.headers["x-vspec-agent"];
  if (Array.isArray(header)) {
    return header[0] ?? fallback;
  }

  return header ?? fallback;
}

function agentTypeFor(value: string): StoredAgentType {
  return knownAgentTypes.has(value as StoredAgentType) ? (value as StoredAgentType) : "OTHER";
}
