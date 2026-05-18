import Fastify, { type FastifyInstance } from "fastify";
import { registerActorTestRoutes } from "./actor-test-routes.js";
import { registerActorRoutes } from "./actor-routes.js";
import { registerGoalRoutes } from "./goal-routes.js";
import { registerGoalPromotionRoutes } from "./goal-promotion-routes.js";
import { registerProjectRoutes } from "./project-routes.js";
import { registerSignupRoutes } from "./signup-routes.js";
import { registerStakeholderRoutes } from "./stakeholder-routes.js";
import { registerStakeholderInterestRoutes } from "./stakeholder-interest-routes.js";
import { registerUseCaseRoutes } from "./usecase-routes.js";
import type { ServerOptions, SignupState } from "./signup-types.js";

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const state = initialState(options);
  registerSignupRoutes(app, options, state);
  registerProjectRoutes(app, state);
  registerActorRoutes(app, state);
  registerActorTestRoutes(app, state);
  registerGoalRoutes(app, state);
  registerGoalPromotionRoutes(app, state);
  registerStakeholderRoutes(app, state);
  registerStakeholderInterestRoutes(app, state);
  registerUseCaseRoutes(app, state);

  return app;
}

function initialState(options: ServerOptions): SignupState {
  const state: SignupState = {
    actorsByProjectId: new Map(),
    branchesById: new Map(),
    goalsByProjectId: new Map(),
    membershipsByUserId: new Map(),
    pendingOAuth: new Map(),
    projectKeysByWorkspaceId: new Map(),
    projectsById: new Map(),
    readOnlyMemberships: new Set(),
    revisionsByEntityId: new Map(),
    sessionsByToken: new Map(),
    stakeholderInterestsByUseCaseId: new Map(),
    stakeholdersByProjectId: new Map(),
    usecasesByProjectId: new Map(),
    usersByGithubId: new Map(),
    workspaceArchivedAt: new Map(),
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
