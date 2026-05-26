import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  invitationAcceptParamsSchema,
  invitationAcceptRequestSchema,
  invitationAcceptResponseSchema,
  invitationCreateParamsSchema,
  invitationCreateRequestSchema
} from "@vooster/contracts";
import {
  emailMismatchProblem,
  invitationExpiredProblem
} from "./invitation-problems.js";
import { invitations, pendingInvitationForEmail } from "./invitation-store.js";
import { sendCreateInvitationResult } from "./invitation-results.js";
import { authenticatedUserId, establishSession } from "./session-support.js";
import { githubProfile, problem } from "./signup-support.js";
import type { ServerOptions, SignupState } from "./signup-types.js";
import type { StoredInvitation, StoredUser } from "../domain/entities/index.js";
import { createInvitation as createInvitationWorkflow } from "../application/invitations.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UserStore } from "../ports/user-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export function registerInvitationRoutes(
  app: FastifyInstance,
  options: ServerOptions,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  app.post("/v1/workspaces/:workspaceId/invitations", (request, reply) =>
    createInvitation(request, reply, state, membershipStore, userStore, workspaceStore)
  );
  app.post("/v1/invitations/:token/accept", (request, reply) =>
    acceptInvitation(request, reply, options, state, membershipStore, userStore)
  );
}

async function createInvitation(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  const params = invitationCreateParamsSchema.parse(request.params);
  const parsed = invitationCreateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid invitation request"));
  }
  return sendCreateInvitationResult(
    reply,
    await createInvitationWorkflow(
      {
        invitationStore: invitationStoreFor(state),
        membershipStore,
        userStore,
        workspaceStore
      },
      {
        email: parsed.data.email,
        role: parsed.data.role,
        simulateDeliveryFailure: parsed.data.simulate_delivery_failure === true,
        simulateExpired: parsed.data.simulate_expired === true,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken),
        workspaceId: params.workspaceId
      }
    )
  );
}

async function acceptInvitation(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ServerOptions,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore
) {
  const token = invitationAcceptParamsSchema.parse(request.params).token;
  const parsed = invitationAcceptRequestSchema.safeParse(request.body);
  const invitation = invitations(state).get(token);
  if (!parsed.success || invitation === undefined) {
    return reply.code(404).send(problem(404, "Invitation not found"));
  }
  if (Date.parse(invitation.expires_at) <= Date.now()) {
    return reply.code(410).send(invitationExpiredProblem());
  }
  const profile = githubProfile(options, parsed.data.code);
  if (profile.email !== invitation.email) {
    return reply.code(422).send(emailMismatchProblem());
  }
  const user = await userForProfile(userStore, profile);
  const membership = {
    id: randomUUID(),
    role: invitation.role,
    user_id: user.id,
    workspace_id: invitation.workspace_id
  };
  invitation.accepted_at = new Date().toISOString();
  await membershipStore.saveMembership(membership);
  establishSession(reply, state.sessionsByToken, user.id);
  return reply.send(
    invitationAcceptResponseSchema.parse({ invitation, membership, user })
  );
}

async function userForProfile(
  userStore: UserStore,
  profile: { avatarUrl: string; email: string; githubId: string; name: string }
): Promise<StoredUser> {
  const existing = await userStore.findUserByGithubId(profile.githubId);
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
  await userStore.saveUser(user);
  return user;
}

function invitationStoreFor(state: SignupState) {
  return {
    pendingInvitationForEmail: (workspaceId: string, email: string) =>
      pendingInvitationForEmail(state, workspaceId, email),
    saveInvitation: (invitation: StoredInvitation) => {
      invitations(state).set(invitation.token, invitation);
    }
  };
}
