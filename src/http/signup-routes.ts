import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { completeOAuth, startGithubOAuth } from "../application/signup.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UserStore } from "../ports/user-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";
import {
  sendCompleteOAuthResult,
  sendDeniedOAuth,
  sendGithubUnavailable
} from "./signup-results.js";
import { clearOAuthState, cookie, fetchGithubProfile, problem, readCookie } from "./signup-support.js";
import type { PendingOAuth, ServerOptions, SignupState } from "./signup-types.js";

const startSignupSchema = z.union([
  z.object({
    workspace: z.object({
      name: z.string().min(1),
      slug: z.string().min(1)
    })
  }),
  z.object({ flow: z.literal("login") })
]);

const callbackQuerySchema = z.union([
  z.object({
    code: z.string().min(1),
    state: z.string().min(1)
  }),
  z.object({
    error: z.literal("access_denied"),
    state: z.string().min(1)
  })
]);

export function registerSignupRoutes(
  app: FastifyInstance,
  options: ServerOptions,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  app.post("/v1/auth/github/start", (request, reply) =>
    startSignup(request, reply, options, state)
  );
  app.get("/v1/auth/github/callback", async (request, reply) => {
    return completeSignup(
      request,
      reply,
      options,
      state,
      membershipStore,
      userStore,
      workspaceStore
    );
  });
}

function startSignup(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ServerOptions,
  state: SignupState
) {
  const parsed = startSignupSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid signup request"));
  }

  const started = startGithubOAuth({
    authStub: options.authStub,
    githubClientId: options.githubOAuth?.clientId,
    input: parsed.data
  });
  state.pendingOAuth.set(started.state, started.pending);
  reply.header("set-cookie", cookie("vspec_oauth_state", started.state));

  return {
    authorization_url: started.authorizationUrl,
    state: started.state
  };
}

async function completeSignup(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ServerOptions,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  const parsed = callbackQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid OAuth callback"));
  }

  if ("error" in parsed.data) {
    const pending = pendingOAuthFor(request, state, parsed.data.state);
    state.pendingOAuth.delete(parsed.data.state);
    clearOAuthState(reply);
    return sendDeniedOAuth(reply, pending?.flow ?? "signup");
  }

  const pending = pendingOAuthFor(request, state, parsed.data.state);
  if (pending === undefined) {
    clearOAuthState(reply);
    return reply.code(400).send(problem(400, "Invalid OAuth state"));
  }

  const profile = await fetchGithubProfile(options, parsed.data.code);
  state.pendingOAuth.delete(parsed.data.state);
  clearOAuthState(reply);
  if (profile === undefined) {
    return sendGithubUnavailable(reply, pending.flow);
  }

  const result = await completeOAuth(
    {
      membershipStore,
      signupStore: options.signupStore,
      userStore,
      workspaceStore
    },
    {
      pending,
      profile
    }
  );
  return sendCompleteOAuthResult(reply, state.sessionsByToken, result);
}

function pendingOAuthFor(
  request: FastifyRequest,
  state: SignupState,
  oauthState: string
): PendingOAuth | undefined {
  const stateCookie = readCookie(request.headers.cookie, "vspec_oauth_state");
  return stateCookie === oauthState ? state.pendingOAuth.get(oauthState) : undefined;
}
