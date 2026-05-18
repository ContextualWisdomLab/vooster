import { randomUUID } from "node:crypto";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import { z } from "zod";

type ServerOptions = {
  authStub: boolean;
};

type PendingSignup = {
  name: string;
  slug: string;
};

type SignupState = {
  pendingSignups: Map<string, PendingSignup>;
};

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

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerSignupRoutes(app, options, { pendingSignups: new Map() });

  return app;
}

function registerSignupRoutes(
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
    reply.header("set-cookie", expiredCookie("vspec_oauth_state"));
    return reply.code(400).send(problem(400, "GitHub authorization denied"));
  }

  const pending = pendingSignup(request, state, parsed.data.state);
  if (pending === undefined) {
    reply.header("set-cookie", expiredCookie("vspec_oauth_state"));
    return reply.code(400).send(problem(400, "Invalid OAuth state"));
  }

  state.pendingSignups.delete(parsed.data.state);
  reply.header("set-cookie", [
    cookie("vspec_session", randomUUID()),
    expiredCookie("vspec_oauth_state")
  ]);

  return reply.code(201).send(signupResponse(options, parsed.data.code, pending));
}

function pendingSignup(
  request: FastifyRequest,
  state: SignupState,
  oauthState: string
): PendingSignup | undefined {
  const stateCookie = readCookie(request.headers.cookie, "vspec_oauth_state");
  return stateCookie === oauthState ? state.pendingSignups.get(oauthState) : undefined;
}

function signupResponse(options: ServerOptions, code: string, pending: PendingSignup) {
  const profile = githubProfile(options, code);
  const user = {
    id: randomUUID(),
    github_id: profile.githubId,
    email: profile.email,
    name: profile.name,
    avatar_url: profile.avatarUrl
  };
  const workspace = workspaceFor(pending, user.id);

  return {
    user,
    workspace,
    membership: ownerMembership(user.id, workspace.id),
    recommended_next_command: "vspec project create"
  };
}

function workspaceFor(pending: PendingSignup, ownerId: string) {
  return {
    id: randomUUID(),
    name: pending.name,
    slug: pending.slug,
    owner_id: ownerId,
    plan: "FREE"
  };
}

function ownerMembership(userId: string, workspaceId: string) {
  return {
    id: randomUUID(),
    user_id: userId,
    workspace_id: workspaceId,
    role: "OWNER"
  };
}

function githubProfile(options: ServerOptions, code: string) {
  if (!options.authStub) {
    throw new Error("GitHub OAuth is not configured.");
  }

  return {
    githubId: code,
    email: `${code}@users.noreply.github.com`,
    name: "Stub GitHub User",
    avatarUrl: "https://github.com/identicons/stub.png"
  };
}

function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

function cookie(name: string, value: string): string {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax`;
}

function expiredCookie(name: string): string {
  return `${name}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax`;
}

function problem(status: number, title: string) {
  return {
    type: "https://vspec.dev/errors/bad-request",
    title,
    status,
    suggested_next_actions: [{ command: "vspec login", reason: "Restart signup." }]
  };
}
