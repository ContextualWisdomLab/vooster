import Fastify, { type FastifyInstance } from "fastify";
import { createMemoryActorStore } from "../infrastructure/memory-actor-store.js";
import { createMemoryBranchStore } from "../infrastructure/memory-branch-store.js";
import { createMemoryGoalStore } from "../infrastructure/memory-goal-store.js";
import { createMemoryLockStore } from "../infrastructure/memory-lock-store.js";
import { createMemoryMembershipStore } from "../infrastructure/memory-membership-store.js";
import { createMemoryMergeRequestStore } from "../infrastructure/memory-merge-request-store.js";
import { createMemoryProjectStore } from "../infrastructure/memory-project-store.js";
import { createMemoryRevisionStore } from "../infrastructure/memory-revision-store.js";
import { createMemoryScenarioStore } from "../infrastructure/memory-scenario-store.js";
import { createMemoryStakeholderInterestStore } from "../infrastructure/memory-stakeholder-interest-store.js";
import { createMemoryStakeholderStore } from "../infrastructure/memory-stakeholder-store.js";
import { createMemoryStepStore } from "../infrastructure/memory-step-store.js";
import { createMemoryUseCaseStore } from "../infrastructure/memory-usecase-store.js";
import { createMemoryUserStore } from "../infrastructure/memory-user-store.js";
import { createMemoryWorkSessionStore } from "../infrastructure/memory-work-session-store.js";
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
import type { UserStore } from "../ports/user-store.js";

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const state = initialState();
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
  const revisionStore = options.signupStore ?? createMemoryRevisionStore();
  const scenarioStore = options.signupStore ?? createMemoryScenarioStore();
  const stakeholderInterestStore =
    options.signupStore ?? createMemoryStakeholderInterestStore();
  const stakeholderStore = options.signupStore ?? createMemoryStakeholderStore();
  const stepStore = options.signupStore ?? createMemoryStepStore();
  const useCaseStore = options.signupStore ?? createMemoryUseCaseStore();
  const userStore = options.signupStore ?? createMemoryUserStore();
  const workSessionStore = options.signupStore ?? createMemoryWorkSessionStore();
  if (options.authStub) {
    await seedStubZeroWorkspaceUser(userStore);
  }
  app.get("/healthz", () => ({ status: "ok" }));
  if (options.signupStore !== undefined) {
    app.addHook("onClose", async () => {
      await options.signupStore?.close();
    });
  }

  registerAiGuideRoutes(app);
  registerApiKeyRoutes(app, state, membershipStore);
  registerSignupRoutes(app, options, state, membershipStore, userStore);
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
    revisionStore,
    useCaseStore
  );
  registerBranchTestRoutes(app, state, branchStore, projectStore, revisionStore, useCaseStore);
  registerLockRoutes(app, state, lockStore, membershipStore, useCaseStore);
  registerMarkdownExportRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    revisionStore,
    useCaseStore,
    scenarioStore,
    stakeholderInterestStore,
    stakeholderStore,
    stepStore
  );
  registerMergeRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    projectStore,
    revisionStore,
    useCaseStore
  );
  registerMergeResolveRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    revisionStore,
    useCaseStore
  );
  registerActorRoutes(app, state, actorStore, membershipStore, revisionStore);
  registerActorTestRoutes(app, state, actorStore, membershipStore);
  registerGherkinExportRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    revisionStore,
    useCaseStore,
    scenarioStore,
    stepStore
  );
  registerGoalRoutes(
    app,
    state,
    actorStore,
    goalStore,
    membershipStore,
    projectStore,
    revisionStore
  );
  registerGoalPromotionRoutes(
    app,
    state,
    goalStore,
    membershipStore,
    projectStore,
    revisionStore,
    useCaseStore
  );
  registerImpactRoutes(
    app,
    state,
    lockStore,
    membershipStore,
    revisionStore,
    workSessionStore,
    useCaseStore
  );
  registerInvitationRoutes(app, options, state, membershipStore, userStore);
  registerCommentRoutes(app, state, membershipStore, useCaseStore);
  registerChangeCommitRoutes(
    app,
    state,
    branchStore,
    projectStore,
    revisionStore,
    useCaseStore
  );
  registerStakeholderRoutes(
    app,
    state,
    membershipStore,
    projectStore,
    revisionStore,
    stakeholderStore
  );
  registerStakeholderInterestRoutes(
    app,
    state,
    membershipStore,
    revisionStore,
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
    revisionStore,
    workSessionStore,
    useCaseStore,
    scenarioStore,
    stakeholderInterestStore,
    stakeholderStore,
    stepStore
  );
  registerUseCaseArchiveRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    revisionStore,
    workSessionStore,
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
    revisionStore,
    stakeholderInterestStore,
    useCaseStore
  );
  registerUseCaseSearchRoutes(app, state, actorStore, membershipStore, useCaseStore);
  registerUseCaseTestRoutes(app, state, useCaseStore);
  registerRevisionDiffRoutes(app, state, branchStore, membershipStore, revisionStore, useCaseStore);
  registerRevisionHistoryRoutes(
    app,
    state,
    membershipStore,
    projectStore,
    revisionStore,
    useCaseStore
  );
  registerRevisionRevertRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    revisionStore,
    workSessionStore,
    useCaseStore
  );
  registerWhoRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    workSessionStore,
    useCaseStore
  );
  registerScenarioRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    scenarioStore,
    revisionStore,
    stakeholderInterestStore,
    stepStore,
    useCaseStore
  );
  registerSessionCompleteRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    mergeRequestStore,
    projectStore,
    workSessionStore
  );
  registerSessionListRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    workSessionStore,
    useCaseStore
  );
  registerSessionRoutes(
    app,
    state,
    branchStore,
    lockStore,
    membershipStore,
    projectStore,
    revisionStore,
    workSessionStore,
    useCaseStore
  );
  registerStepRoutes(
    app,
    state,
    lockStore,
    membershipStore,
    scenarioStore,
    revisionStore,
    stepStore,
    workSessionStore,
    useCaseStore
  );
  registerSyncRoutes(
    app,
    state,
    branchStore,
    membershipStore,
    projectStore,
    revisionStore,
    useCaseStore
  );

  return app;
}

function initialState(): SignupState {
  const state: SignupState = {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map(),
    workspaceArchivedAt: new Map(),
    workspacesById: new Map(),
    workspaceSlugs: new Set()
  };

  return state;
}

async function seedStubZeroWorkspaceUser(userStore: UserStore) {
  if (await userStore.findUserByGithubId("stub-zero-workspace-user") !== undefined) {
    return;
  }

  await userStore.saveUser({
    id: "stub-zero-workspace-user-id",
    github_id: "stub-zero-workspace-user",
    email: "stub-zero-workspace-user@users.noreply.github.com",
    name: "Stub Zero Workspace User",
    avatar_url: "https://github.com/identicons/stub-zero-workspace-user.png"
  });
}
