import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { establishSession } from "./session-support.js";
import {
  clearOAuthState,
  cookie,
  fetchGithubProfile,
  githubUnavailable,
  problem,
  readCookie,
  signupEntities,
  signupResponse
} from "./signup-support.js";
import type { GithubProfile, PendingOAuth, PendingSignup, ServerOptions, SignupState } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { SignupStore } from "../ports/signup-store.js";
import type { UserStore } from "../ports/user-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

const startSignupSchema = z.union([
  z.object({
    workspace: z.object({
      name: z.string().min(1),
      slug: z.string().min(1)
    })
  }),
  z.object({ flow: z.literal("login") })
]);

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
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore
) {
  app.post("/v1/auth/github/start", (request, reply) =>
    startSignup(request, reply, state)
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
  state: SignupState
) {
  const parsed = startSignupSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid signup request"));
  }

  const oauthState = randomUUID();
  state.pendingOAuth.set(oauthState, pendingOAuth(parsed.data));
  reply.header("set-cookie", cookie("vspec_oauth_state", oauthState));

  return {
    authorization_url: `https://github.com/login/oauth/authorize?state=${oauthState}`,
    state: oauthState
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
    if (pending?.flow === "login") {
      return reply.code(401).send(
        problem(401, "GitHub authorization denied", {}, [
          { command: "vspec login", reason: "Retry login." }
        ])
      );
    }

    return reply.code(400).send(problem(400, "GitHub authorization denied"));
  }

  const pending = pendingOAuthFor(request, state, parsed.data.state);
  if (pending === undefined) {
    clearOAuthState(reply);
    return reply.code(400).send(problem(400, "Invalid OAuth state"));
  }

  const profile = fetchGithubProfile(options, parsed.data.code);
  state.pendingOAuth.delete(parsed.data.state);
  clearOAuthState(reply);
  if (profile === undefined) {
    return githubUnavailable(reply, pending.flow);
  }

  if (!profile.emailVerified) {
    return reply.code(422).send(problem(422, "Verify your GitHub email"));
  }

  if (pending.flow === "login") {
    return completeLogin(reply, state, membershipStore, userStore, workspaceStore, profile);
  }

  return completeVerifiedSignup(
    reply,
    state,
    options.signupStore,
    membershipStore,
    userStore,
    workspaceStore,
    profile,
    pending.workspace
  );
}

function pendingOAuth(data: z.infer<typeof startSignupSchema>): PendingOAuth {
  return "flow" in data ? { flow: "login" } : { flow: "signup", workspace: data.workspace };
}

async function completeVerifiedSignup(
  reply: FastifyReply,
  state: SignupState,
  store: SignupStore | undefined,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore,
  profile: GithubProfile,
  pending: PendingSignup
) {
  if (await workspaceStore.workspaceSlugExists(pending.slug)) {
    return reply.code(422).send(
      problem(422, "Workspace slug is already taken", {
        suggested_alternative_slug: await workspaceStore.nextAvailableWorkspaceSlug(pending.slug)
      })
    );
  }

  const entities = signupEntities(profile, pending);
  if (store === undefined) {
    await userStore.saveUser(entities.user);
    await membershipStore.saveMembership(entities.membership);
    await workspaceStore.saveWorkspace(entities.workspace);
  } else {
    await store.saveSignup(entities);
  }

  establishSession(reply, state.sessionsByToken, entities.user.id);
  return reply
    .code(201)
    .send(signupResponse(entities.user, entities.workspace, entities.membership));
}

async function completeLogin(
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  userStore: UserStore,
  workspaceStore: WorkspaceStore,
  profile: GithubProfile
) {
  const user = await userStore.findUserByGithubId(profile.githubId);
  if (user === undefined) {
    return reply.code(404).send(
      problem(404, "No vspec user exists for GitHub identity", {}, [
        { command: "vspec login", reason: "Sign up before logging in." }
      ])
    );
  }

  user.last_login_at = new Date().toISOString();
  await userStore.updateLastLoginAt(user.id, user.last_login_at);
  establishSession(reply, state.sessionsByToken, user.id);
  const workspaces = !isSignupStore(userStore)
    ? await workspacesForUser(membershipStore, workspaceStore, user.id)
    : await userStore.workspaceSummariesForUser(user.id);

  return reply.code(200).send({
    user,
    workspaces,
    ...(workspaces.length === 0
      ? { recommended_next_command: "vspec workspace create" }
      : {})
  });
}

async function workspacesForUser(
  membershipStore: MembershipStore,
  workspaceStore: WorkspaceStore,
  userId: string
) {
  const memberships = await membershipStore.membershipsForUser(userId);
  const summaries = await Promise.all(
    memberships.map(async (membership) => {
      const workspace = await workspaceStore.findWorkspaceById(membership.workspace_id);
      return workspace === undefined
        ? undefined
        : { id: workspace.id, role: membership.role, slug: workspace.slug };
    })
  );

  return summaries.filter((summary): summary is NonNullable<typeof summary> =>
    summary !== undefined
  );
}

function isSignupStore(userStore: UserStore): userStore is SignupStore {
  return "workspaceSummariesForUser" in userStore;
}

function pendingOAuthFor(
  request: FastifyRequest,
  state: SignupState,
  oauthState: string
): PendingOAuth | undefined {
  const stateCookie = readCookie(request.headers.cookie, "vspec_oauth_state");
  return stateCookie === oauthState ? state.pendingOAuth.get(oauthState) : undefined;
}
