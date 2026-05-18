import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId, establishSession } from "./session-support.js";
import { addMembership, githubProfile, problem } from "./signup-support.js";
import type { ServerOptions, SignupState, StoredMembership, StoredUser } from "./signup-types.js";

type StoredInvitation = {
  accepted_at: null | string;
  delivery_status: "FAILED" | "SENT";
  email: string;
  expires_at: string;
  id: string;
  role: "EDITOR" | "OWNER";
  token: string;
  workspace_id: string;
};

const invitationsByState = new WeakMap<SignupState, Map<string, StoredInvitation>>();
const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(["EDITOR", "OWNER"])
});
const acceptSchema = z.object({ code: z.string().min(1) });

export function registerInvitationRoutes(
  app: FastifyInstance,
  options: ServerOptions,
  state: SignupState
) {
  app.post("/v1/workspaces/:workspaceId/invitations", (request, reply) =>
    createInvitation(request, reply, state)
  );
  app.post("/v1/invitations/:token/accept", (request, reply) =>
    acceptInvitation(request, reply, options, state)
  );
}

function createInvitation(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const params = z.object({ workspaceId: z.string().min(1) }).parse(request.params);
  const parsed = inviteSchema.safeParse(request.body);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  const membership = workspaceMembership(state, userId, params.workspaceId);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid invitation request"));
  }
  if (!state.workspacesById.has(params.workspaceId) || membership === undefined) {
    return reply.code(403).send(problem(403, "Workspace owner role required"));
  }
  if (membership.role !== "OWNER" && parsed.data.role === "OWNER") {
    return reply.code(403).send(editorOwnerInviteProblem());
  }
  if (activeMembershipForEmail(state, params.workspaceId, parsed.data.email) !== undefined) {
    return reply.code(422).send(alreadyMemberProblem());
  }
  const invitation = {
    accepted_at: null,
    delivery_status: "SENT" as const,
    email: parsed.data.email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    id: randomUUID(),
    role: parsed.data.role,
    token: randomUUID(),
    workspace_id: params.workspaceId
  };
  invitations(state).set(invitation.token, invitation);
  return reply.code(201).send(invitationResponse(invitation));
}

function acceptInvitation(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ServerOptions,
  state: SignupState
) {
  const token = z.object({ token: z.string().min(1) }).parse(request.params).token;
  const parsed = acceptSchema.safeParse(request.body);
  const invitation = invitations(state).get(token);
  if (!parsed.success || invitation === undefined) {
    return reply.code(404).send(problem(404, "Invitation not found"));
  }
  const profile = githubProfile(options, parsed.data.code);
  const user = userForProfile(state, profile);
  const membership = {
    id: randomUUID(),
    role: invitation.role,
    user_id: user.id,
    workspace_id: invitation.workspace_id
  };
  invitation.accepted_at = new Date().toISOString();
  addMembership(state.membershipsByUserId, membership);
  establishSession(reply, state.sessionsByToken, user.id);
  return reply.send({ invitation, membership, user });
}

function workspaceMembership(
  state: SignupState,
  userId: string | undefined,
  workspaceId: string
): StoredMembership | undefined {
  return (state.membershipsByUserId.get(userId ?? "") ?? []).find(
    (membership) => membership.workspace_id === workspaceId
  );
}

function editorOwnerInviteProblem() {
  return problem(
    403,
    "Only workspace owners can invite owners",
    {},
    [
      {
        command: "vspec member invite --role editor",
        reason: "Invite the teammate as an editor or ask a workspace owner."
      }
    ]
  );
}

function activeMembershipForEmail(state: SignupState, workspaceId: string, email: string) {
  const user = [...state.usersByGithubId.values()].find((candidate) => candidate.email === email);
  return (state.membershipsByUserId.get(user?.id ?? "") ?? []).find(
    (membership) => membership.workspace_id === workspaceId
  );
}

function alreadyMemberProblem() {
  return problem(
    422,
    "Email already belongs to a workspace member",
    { code: "already_member" },
    [
      {
        command: "vspec member set-role",
        reason: "Change the existing member role instead of inviting again."
      }
    ]
  );
}

function userForProfile(
  state: SignupState,
  profile: { avatarUrl: string; email: string; githubId: string; name: string }
): StoredUser {
  const existing = state.usersByGithubId.get(profile.githubId);
  if (existing !== undefined) {
    return existing;
  }
  const user = {
    avatar_url: profile.avatarUrl,
    email: profile.email,
    github_id: profile.githubId,
    id: randomUUID(),
    name: profile.name
  };
  state.usersByGithubId.set(user.github_id, user);
  return user;
}

function invitationResponse(invitation: StoredInvitation) {
  return {
    invitation,
    suggested_next_actions: [
      {
        command: "vspec member list",
        reason: "Review pending and active workspace members."
      }
    ]
  };
}

function invitations(state: SignupState) {
  const existing = invitationsByState.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, StoredInvitation>();
  invitationsByState.set(state, created);
  return created;
}
