import Fastify, { type FastifyInstance } from "fastify";
import { registerSignupRoutes } from "./signup-routes.js";
import type { ServerOptions } from "./signup-types.js";

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerSignupRoutes(app, options, {
    membershipsByUserId: new Map(),
    pendingOAuth: new Map(),
    usersByGithubId: new Map(),
    workspacesById: new Map(),
    workspaceSlugs: new Set()
  });

  return app;
}
