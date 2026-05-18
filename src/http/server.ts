import Fastify, { type FastifyInstance } from "fastify";
import { registerSignupRoutes } from "./signup-routes.js";
import type { ServerOptions, SignupState } from "./signup-types.js";

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerSignupRoutes(app, options, initialState(options));

  return app;
}

function initialState(options: ServerOptions): SignupState {
  const state: SignupState = {
    membershipsByUserId: new Map(),
    pendingOAuth: new Map(),
    usersByGithubId: new Map(),
    workspacesById: new Map(),
    workspaceSlugs: new Set()
  };

  if (options.authStub) {
    state.usersByGithubId.set("stub-zero-workspace-user", {
      id: "stub-zero-workspace-user-id",
      github_id: "stub-zero-workspace-user",
      email: "stub-zero-workspace-user@users.noreply.github.com",
      name: "Stub Zero Workspace User",
      avatar_url: "https://github.com/identicons/stub-zero-workspace-user.png"
    });
  }

  return state;
}
