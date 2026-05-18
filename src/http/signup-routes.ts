import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  alternativeSlug,
  clearOAuthState,
  establishSession,
  GithubNetworkError,
  githubProfile,
  problem,
  readCookie,
  signupResponse
} from "./signup-support.js";
import type {
  GithubProfile,
  PendingSignup,
  ServerOptions,
  SignupState
} from "./signup-types.js";

const startSignupSchema = z.object({
  workspace: z.object({
    name: z.string().min(1),
    slug: z.string().min(1)
  })
});

const callbackSuccessQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

const callbackDeniedQuerySchema = z.object({
  error: z.literal("access_denied"),
  state: z.string().min(1)
});

const callbackQuerySchema = z.union([
  callbackSuccessQuerySchema,
  callbackDeniedQuerySchema
]);

export function registerSignupRoutes(
  app: FastifyInstance,
  options: ServerOptions,
  state: SignupState
) {
  app.post("/v1/auth/github/start", (request, reply) =>
    startSignup(request, reply, state)
  );
  app.get("/v1/auth/github/callback", async (request, reply) => {
    return completeSignup(request, reply, options, state);
  });
}

function startSignup(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const parsed = startSignupSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid signup request"));
  }

  const oauthState = randomUUID();
  state.pendingSignups.set(oauthState, parsed.data.workspace);
  reply.header("set-cookie", cookie("vspec_oauth_state", oauthState));

  return {
    authorization_url: `https://github.com/login/oauth/authorize?state=${oauthState}`,
    state: oauthState
  };
}

function completeSignup(
  request: FastifyRequest,
  reply: FastifyReply,
  options: ServerOptions,
  state: SignupState
) {
  const parsed = callbackQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid OAuth callback"));
  }

  if ("error" in parsed.data) {
    state.pendingSignups.delete(parsed.data.state);
    clearOAuthState(reply);
    return reply.code(400).send(problem(400, "GitHub authorization denied"));
  }

  const pending = pendingSignup(request, state, parsed.data.state);
  if (pending === undefined) {
    clearOAuthState(reply);
    return reply.code(400).send(problem(400, "Invalid OAuth state"));
  }

  const profile = fetchGithubProfile(options, parsed.data.code);
  state.pendingSignups.delete(parsed.data.state);
  clearOAuthState(reply);
  if (profile === undefined) {
    return githubUnavailable(reply);
  }

  if (!profile.emailVerified) {
    return reply.code(422).send(problem(422, "Verify your GitHub email"));
  }

  return completeVerifiedSignup(reply, state, profile, pending);
}

function fetchGithubProfile(
  options: ServerOptions,
  code: string
): GithubProfile | undefined {
  try {
    return githubProfile(options, code);
  } catch (error) {
    if (error instanceof GithubNetworkError) {
      return undefined;
    }

    throw error;
  }
}

function githubUnavailable(reply: FastifyReply) {
  return reply.code(502).send(
    problem(502, "GitHub is unavailable", {}, [
      { command: "vspec login", reason: "Retry signup after GitHub is reachable." }
    ])
  );
}

function completeVerifiedSignup(
  reply: FastifyReply,
  state: SignupState,
  profile: ReturnType<typeof githubProfile>,
  pending: PendingSignup
) {
  if (state.workspaceSlugs.has(pending.slug)) {
    return reply.code(422).send(
      problem(422, "Workspace slug is already taken", {
        suggested_alternative_slug: alternativeSlug(pending.slug, state.workspaceSlugs)
      })
    );
  }

  state.workspaceSlugs.add(pending.slug);
  establishSession(reply);
  return reply.code(201).send(signupResponse(profile, pending));
}

function pendingSignup(
  request: FastifyRequest,
  state: SignupState,
  oauthState: string
): PendingSignup | undefined {
  const stateCookie = readCookie(request.headers.cookie, "vspec_oauth_state");
  return stateCookie === oauthState ? state.pendingSignups.get(oauthState) : undefined;
}

function cookie(name: string, value: string): string {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax`;
}
