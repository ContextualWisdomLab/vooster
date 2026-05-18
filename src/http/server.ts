import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

type ServerOptions = {
  authStub: boolean;
};

type PendingSignup = {
  name: string;
  slug: string;
};

const startSignupSchema = z.object({
  workspace: z.object({
    name: z.string().min(1),
    slug: z.string().min(1)
  })
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const pendingSignups = new Map<string, PendingSignup>();

  app.post("/v1/auth/github/start", async (request, reply) => {
    const parsed = startSignupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(problem(400, "Invalid signup request"));
    }

    const state = randomUUID();
    pendingSignups.set(state, parsed.data.workspace);
    reply.header("set-cookie", cookie("vspec_oauth_state", state));

    return {
      authorization_url: `https://github.com/login/oauth/authorize?state=${state}`,
      state
    };
  });

  app.get("/v1/auth/github/callback", async (request, reply) => {
    const parsed = callbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(problem(400, "Invalid OAuth callback"));
    }

    const stateCookie = readCookie(request.headers.cookie, "vspec_oauth_state");
    const pending = pendingSignups.get(parsed.data.state);
    if (stateCookie !== parsed.data.state || pending === undefined) {
      return reply.code(400).send(problem(400, "Invalid OAuth state"));
    }

    const profile = githubProfile(options, parsed.data.code);
    const user = {
      id: randomUUID(),
      github_id: profile.githubId,
      email: profile.email,
      name: profile.name,
      avatar_url: profile.avatarUrl
    };
    const workspace = {
      id: randomUUID(),
      name: pending.name,
      slug: pending.slug,
      owner_id: user.id,
      plan: "FREE"
    };
    const membership = {
      id: randomUUID(),
      user_id: user.id,
      workspace_id: workspace.id,
      role: "OWNER"
    };

    pendingSignups.delete(parsed.data.state);
    reply.header("set-cookie", [
      cookie("vspec_session", randomUUID()),
      expiredCookie("vspec_oauth_state")
    ]);

    return reply.code(201).send({
      user,
      workspace,
      membership,
      recommended_next_command: "vspec project create"
    });
  });

  return app;
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
