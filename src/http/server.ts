import Fastify, { type FastifyInstance } from "fastify";
import { createMemoryActorStore } from "../infrastructure/memory-actor-store.js";
import { registerAiGuideRoutes } from "./ai-guide-routes.js";
import { registerApiKeyRoutes } from "./api-key-routes.js";
import { registerActorTestRoutes } from "./actor-test-routes.js";
import { registerActorRoutes } from "./actor-routes.js";
import { registerBranchRoutes } from "./branch-routes.js";
import { registerBranchTestRoutes } from "./branch-test-routes.js";
import { registerChangeCommitRoutes } from "./change-commit-routes.js";
import { registerCommentRoutes } from "./comment-routes.js";
import { registerGherkinExportRoutes } from "./gherkin-export-routes.js";
import { registerGoalRoutes } from "./goal-routes.js";
import { registerGoalPromotionRoutes } from "./goal-promotion-routes.js";
import { registerImpactRoutes } from "./impact-routes.js";
import { registerInvitationRoutes } from "./invitation-routes.js";
import { registerLockRoutes } from "./lock-routes.js";
import { registerMarkdownExportRoutes } from "./markdown-export-routes.js";
import { registerMergeRoutes } from "./merge-routes.js";
import { registerMergeResolveRoutes } from "./merge-resolve-routes.js";
import { registerProjectRoutes } from "./project-routes.js";
import { registerRevisionDiffRoutes } from "./revision-diff-routes.js";
import { registerRevisionHistoryRoutes } from "./revision-history-routes.js";
import { registerRevisionRevertRoutes } from "./revision-revert-routes.js";
import { registerScenarioRoutes } from "./scenario-routes.js";
import { registerSessionCompleteRoutes } from "./session-complete-routes.js";
import { registerSessionListRoutes } from "./session-list-routes.js";
import { registerSessionRoutes } from "./session-routes.js";
import { registerSignupRoutes } from "./signup-routes.js";
import { registerStakeholderRoutes } from "./stakeholder-routes.js";
import { registerStakeholderInterestRoutes } from "./stakeholder-interest-routes.js";
import { registerStepRoutes } from "./step-routes.js";
import { registerSyncRoutes } from "./sync-routes.js";
import { registerUseCaseTestRoutes } from "./usecase-test-routes.js";
import { registerUseCaseAgentRoutes } from "./usecase-agent-routes.js";
import { registerUseCaseArchiveRoutes } from "./usecase-archive-routes.js";
import { registerUseCaseRoutes } from "./usecase-routes.js";
import { registerUseCaseSearchRoutes } from "./usecase-search-routes.js";
import { registerWhoRoutes } from "./who-routes.js";
import type { ServerOptions, SignupState } from "./signup-types.js";

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const state = initialState(options);
  const actorStore = options.signupStore ?? createMemoryActorStore();
  app.get("/healthz", () => ({ status: "ok" }));
  if (options.signupStore !== undefined) {
    app.addHook("onClose", async () => {
      await options.signupStore?.close();
    });
  }

  registerAiGuideRoutes(app);
  registerApiKeyRoutes(app, state);
  registerSignupRoutes(app, options, state);
  registerProjectRoutes(app, state, options.signupStore);
  registerBranchRoutes(app, state);
  registerBranchTestRoutes(app, state);
  registerLockRoutes(app, state);
  registerMarkdownExportRoutes(app, state, actorStore);
  registerMergeRoutes(app, state);
  registerMergeResolveRoutes(app, state);
  registerActorRoutes(app, state, actorStore, options.signupStore);
  registerActorTestRoutes(app, state, actorStore);
  registerGherkinExportRoutes(app, state, actorStore);
  registerGoalRoutes(app, state, actorStore);
  registerGoalPromotionRoutes(app, state);
  registerImpactRoutes(app, state);
  registerInvitationRoutes(app, options, state);
  registerCommentRoutes(app, state);
  registerChangeCommitRoutes(app, state);
  registerStakeholderRoutes(app, state);
  registerStakeholderInterestRoutes(app, state);
  registerUseCaseAgentRoutes(app, state, actorStore);
  registerUseCaseArchiveRoutes(app, state);
  registerUseCaseRoutes(app, state, actorStore);
  registerUseCaseSearchRoutes(app, state, actorStore);
  registerUseCaseTestRoutes(app, state);
  registerRevisionDiffRoutes(app, state);
  registerRevisionHistoryRoutes(app, state);
  registerRevisionRevertRoutes(app, state);
  registerWhoRoutes(app, state);
  registerScenarioRoutes(app, state, actorStore);
  registerSessionCompleteRoutes(app, state);
  registerSessionListRoutes(app, state);
  registerSessionRoutes(app, state);
  registerStepRoutes(app, state);
  registerSyncRoutes(app, state);

  return app;
}

function initialState(options: ServerOptions): SignupState {
  const state: SignupState = {
    branchesById: new Map(),
    goalsByProjectId: new Map(),
    membershipsByUserId: new Map(),
    mergeRequestsById: new Map(),
    pendingOAuth: new Map(),
    projectKeysByWorkspaceId: new Map(),
    projectsById: new Map(),
    readOnlyMemberships: new Set(),
    revisionsByEntityId: new Map(),
    sessionsByToken: new Map(),
    scenariosByUseCaseId: new Map(),
    stepLocksByUseCaseId: new Map(),
    stakeholderInterestsByUseCaseId: new Map(),
    stepsByScenarioId: new Map(),
    stakeholdersByProjectId: new Map(),
    usecasesByProjectId: new Map(),
    usersByGithubId: new Map(),
    workSessionsById: new Map(),
    workSessionsByUseCaseId: new Map(),
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
