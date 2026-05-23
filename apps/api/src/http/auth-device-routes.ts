import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { completeOAuth, type CompleteOAuthResult } from "../application/signup.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UserStore } from "../ports/user-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";
import { establishSession } from "./session-support.js";
import { sendCompleteOAuthResult, sendGithubUnavailable } from "./signup-results.js";
import {
  fetchGithubProfileByAccessToken,
  problem,
  readCookie
} from "./signup-support.js";
import type { ServerOptions, SignupState } from "./signup-types.js";

const deviceTokenSchema = z.object({
  access_token: z.string().min(1),
  workspace: z
    .object({
      name: z.string().min(1),
      slug: z.string().min(1)
    })
    .optional()
});

export function registerDeviceAuthRoutes(
  app: FastifyInstance,
  options: ServerOptions,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  app.post("/v1/auth/github/token", (request, reply) =>
    completeDeviceFlow(
      request,
      reply,
      options,
      state,
      membershipStore,
      userStore,
      workspaceStore
    )
  );
  app.post("/v1/auth/logout", (request, reply) => {
    const token = readCookie(request.headers.cookie, "vspec_session");
    if (token !== undefined) {
      state.sessionsByToken.delete(token);
    }

    return reply.code(204).send();
  });
}

async function completeDeviceFlow(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ServerOptions,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  const parsed = deviceTokenSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid device token request"));
  }

  const profile = await fetchGithubProfileByAccessToken(
    options,
    parsed.data.access_token
  );
  if (profile === undefined) {
    return sendGithubUnavailable(reply, "login");
  }

  const deps = {
    membershipStore,
    signupStore: options.signupStore,
    userStore,
    workspaceStore
  };
  const pending =
    parsed.data.workspace === undefined
      ? { flow: "login" as const }
      : { flow: "signup" as const, workspace: parsed.data.workspace };
  const result = await completeOAuth(deps, { pending, profile });
  if (result.status !== "USER_NOT_FOUND" || parsed.data.workspace !== undefined) {
    return sendCompleteOAuthResult(reply, state.sessionsByToken, result);
  }

  return sendFallbackSignupAsLogin(
    reply,
    state.sessionsByToken,
    await completeOAuth(deps, {
      pending: { flow: "signup", workspace: defaultWorkspaceFor(profile.githubId) },
      profile
    })
  );
}

function defaultWorkspaceFor(githubId: string) {
  return {
    name: `GitHub ${githubId}`,
    slug: `github-${githubId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`
  };
}

function sendFallbackSignupAsLogin(
  reply: FastifyReply,
  sessionsByToken: Map<string, string>,
  result: CompleteOAuthResult
) {
  if (result.status !== "SIGNED_UP") {
    return sendCompleteOAuthResult(reply, sessionsByToken, result);
  }

  establishSession(reply, sessionsByToken, result.user.id);
  return reply.code(200).send({
    user: result.user,
    workspaces: [
      {
        id: result.workspace.id,
        role: result.membership.role,
        slug: result.workspace.slug
      }
    ]
  });
}
