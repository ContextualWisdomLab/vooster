import Fastify, { type FastifyInstance } from "fastify";
import { createMemoryActorStore } from "../infrastructure/memory-actor-store.js";
import { createMemoryBranchStore } from "../infrastructure/memory-branch-store.js";
import { createMemoryGoalStore } from "../infrastructure/memory-goal-store.js";
import { createMemoryLockStore } from "../infrastructure/memory-lock-store.js";
import { createMemoryMembershipStore } from "../infrastructure/memory-membership-store.js";
import { createMemoryMergeRequestStore } from "../infrastructure/memory-merge-request-store.js";
import { createMemoryProjectStore } from "../infrastructure/memory-project-store.js";
import { createMemoryScenarioStore } from "../infrastructure/memory-scenario-store.js";
import { createMemoryStakeholderInterestStore } from "../infrastructure/memory-stakeholder-interest-store.js";
import { createMemoryStakeholderStore } from "../infrastructure/memory-stakeholder-store.js";
import { createMemoryUseCaseStore } from "../infrastructure/memory-usecase-store.js";
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
  const branchStore = options.signupStore ?? createMemoryBranchStore();
  const goalStore = options.signupStore ?? createMemoryGoalStore();
  const lockStore = options.signupStore ?? createMemoryLockStore();
  const projectStore = options.signupStore ?? createMemoryProjectStore();
  const membershipStore =
    options.signupStore ??
    createMemoryMembershipStore(async (projectId) =>
      (await projectStore.findProjectById(projectId))?.workspace_id
    );
  const mergeRequestStore = options.signupStore ?? createMemoryMergeRequestStore();
  const scenarioStore = options.signupStore ?? createMemoryScenarioStore();
  const stakeholderInterestStore =
    options.signupStore ?? createMemoryStakeholderInterestStore();
  const stakeholderStore = options.signupStore ?? createMemoryStakeholderStore();
  const useCaseStore = options.signupStore ?? createMemoryUseCaseStore();
  app.get("/healthz", () => ({ status: "ok" }));
  if (options.signupStore !== undefined) {
    app.addHook("onClose", async () => {
      await options.signupStore?.close();
    });
  }

  registerAiGuideRoutes(app);
  registerApiKeyRoutes(app, state, membershipStore);
  registerSignupRoutes(app, options, state, membershipStore);
  registerProjectRoutes(
    app,
    state,
    options.signupStore,
    branchStore,
    membershipStore,
    projectStore
  );
  registerBranchRoutes(
    app,
    state,
    branchStore,
    projectStore,
    membershipStore,
    mergeRequestStore,
    useCaseStore
  );
  registerBranchTestRoutes(app, state, branchStore, projectStore, useCaseStore);
  registerLockRoutes(app, state, lockStore, membershipStore, useCaseStore);
  registerMarkdownExportRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    useCaseStore,
    scenarioStore,
    stakeholderInterestStore,
    stakeholderStore
  );
  registerMergeRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    projectStore,
    useCaseStore
  );
  registerMergeResolveRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    useCaseStore
  );
  registerActorRoutes(app, state, actorStore, membershipStore);
  registerActorTestRoutes(app, state, actorStore, membershipStore);
  registerGherkinExportRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    useCaseStore,
    scenarioStore
  );
  registerGoalRoutes(app, state, actorStore, goalStore, membershipStore, projectStore);
  registerGoalPromotionRoutes(
    app,
    state,
    goalStore,
    membershipStore,
    projectStore,
    useCaseStore
  );
  registerImpactRoutes(app, state, lockStore, membershipStore, useCaseStore);
  registerInvitationRoutes(app, options, state, membershipStore);
  registerCommentRoutes(app, state, membershipStore, useCaseStore);
  registerChangeCommitRoutes(app, state, branchStore, projectStore, useCaseStore);
  registerStakeholderRoutes(app, state, membershipStore, projectStore, stakeholderStore);
  registerStakeholderInterestRoutes(
    app,
    state,
    membershipStore,
    stakeholderInterestStore,
    stakeholderStore,
    useCaseStore
  );
  registerUseCaseAgentRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    projectStore,
    useCaseStore,
    scenarioStore,
    stakeholderInterestStore,
    stakeholderStore
  );
  registerUseCaseArchiveRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    useCaseStore
  );
  registerUseCaseRoutes(
    app,
    state,
    actorStore,
    branchStore,
    goalStore,
    membershipStore,
    projectStore,
    stakeholderInterestStore,
    useCaseStore
  );
  registerUseCaseSearchRoutes(app, state, actorStore, membershipStore, useCaseStore);
  registerUseCaseTestRoutes(app, state, useCaseStore);
  registerRevisionDiffRoutes(app, state, branchStore, membershipStore, useCaseStore);
  registerRevisionHistoryRoutes(app, state, membershipStore, projectStore, useCaseStore);
  registerRevisionRevertRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    useCaseStore
  );
  registerWhoRoutes(app, state, branchStore, lockStore, membershipStore, mergeRequestStore, useCaseStore);
  registerScenarioRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    scenarioStore,
    stakeholderInterestStore,
    useCaseStore
  );
  registerSessionCompleteRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    projectStore
  );
  registerSessionListRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    useCaseStore
  );
  registerSessionRoutes(app, state, branchStore, lockStore, membershipStore, projectStore, useCaseStore);
  registerStepRoutes(app, state, lockStore, membershipStore, scenarioStore, useCaseStore);
  registerSyncRoutes(app, state, branchStore, membershipStore, projectStore, useCaseStore);

  return app;
}

function initialState(options: ServerOptions): SignupState {
  const state: SignupState = {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    revisionsByEntityId: new Map(),
    sessionsByToken: new Map(),
    stepsByScenarioId: new Map(),
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
