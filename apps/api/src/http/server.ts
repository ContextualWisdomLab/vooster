import Fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { healthResponseSchema } from "@vooster/contracts";
import { createMemoryApiKeyStore } from "../infrastructure/memory-api-key-store.js";
import { createMemoryActorStore } from "../infrastructure/memory-actor-store.js";
import { createMemoryBranchStore } from "../infrastructure/memory-branch-store.js";
import { createMemoryCommentStore } from "../infrastructure/memory-comment-store.js";
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
import { createMemoryWorkspaceStore } from "../infrastructure/memory-workspace-store.js";
import { createMemoryWorkSessionStore } from "../infrastructure/memory-work-session-store.js";
import { registerAiGuideRoutes } from "./ai-guide-routes.js";
import { registerApiKeyRoutes } from "./api-key-routes.js";
import { registerActorTestRoutes } from "./actor-test-routes.js";
import { registerActorRoutes } from "./actor-routes.js";
import { registerDeviceAuthRoutes } from "./auth-device-routes.js";
import { registerBranchRoutes } from "./branch-routes.js";
import { registerBranchTestRoutes } from "./branch-test-routes.js";
import { registerChangeCommitRoutes } from "./change-commit-routes.js";
import { registerCommentRoutes } from "./comment-routes.js";
import { registerDoctorRoutes } from "./doctor-routes.js";
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
import { registerUseCaseUpdateRoutes } from "./usecase-update-routes.js";
import { registerWhoRoutes } from "./who-routes.js";
import type { GithubOAuthConfig, ServerOptions, SignupState } from "./signup-types.js";
import type { UserStore } from "../ports/user-store.js";

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const serverOptions = withGithubOAuthFromEnv(options);
  const app = Fastify({ logger: false });

  // 🛡️ Sentinel: Add security headers to protect against common web vulnerabilities like XSS, clickjacking, etc.
  await app.register(fastifyHelmet);

  // 🛡️ Sentinel: Configure CORS strictly using explicit allowed origins.
  // Prevents unauthorized cross-origin requests. Fails secure (origin: false) if no origins are configured.
  const allowedOriginsRaw = process.env.VSPEC_ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsRaw ? allowedOriginsRaw.split(",") : [];

  await app.register(fastifyCors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false
  });
  const state = initialState();
  const apiKeyStore = serverOptions.signupStore ?? createMemoryApiKeyStore();
  const actorStore = serverOptions.signupStore ?? createMemoryActorStore();
  const branchStore = serverOptions.signupStore ?? createMemoryBranchStore();
  const commentStore = serverOptions.signupStore ?? createMemoryCommentStore();
  const goalStore = serverOptions.signupStore ?? createMemoryGoalStore();
  const lockStore = serverOptions.signupStore ?? createMemoryLockStore();
  const projectStore = serverOptions.signupStore ?? createMemoryProjectStore();
  const membershipStore =
    serverOptions.signupStore ??
    createMemoryMembershipStore(
      async (projectId) => (await projectStore.findProjectById(projectId))?.workspace_id
    );
  const mergeRequestStore =
    serverOptions.signupStore ?? createMemoryMergeRequestStore();
  const revisionStore = serverOptions.signupStore ?? createMemoryRevisionStore();
  const scenarioStore = serverOptions.signupStore ?? createMemoryScenarioStore();
  const stakeholderInterestStore =
    serverOptions.signupStore ?? createMemoryStakeholderInterestStore();
  const stakeholderStore = serverOptions.signupStore ?? createMemoryStakeholderStore();
  const stepStore = serverOptions.signupStore ?? createMemoryStepStore();
  const useCaseStore = serverOptions.signupStore ?? createMemoryUseCaseStore();
  const userStore = serverOptions.signupStore ?? createMemoryUserStore();
  const workspaceStore = serverOptions.signupStore ?? createMemoryWorkspaceStore();
  const workSessionStore = serverOptions.signupStore ?? createMemoryWorkSessionStore();
  if (serverOptions.authStub) {
    await seedStubZeroWorkspaceUser(userStore);
  }
  app.get("/healthz", () => healthResponseSchema.parse({ status: "ok" }));
  if (serverOptions.signupStore !== undefined) {
    app.addHook("onClose", async () => {
      await serverOptions.signupStore?.close();
    });
  }

  registerAiGuideRoutes(app);
  registerApiKeyRoutes(app, state, membershipStore, apiKeyStore);
  registerSignupRoutes(
    app,
    serverOptions,
    state,
    membershipStore,
    userStore,
    workspaceStore
  );
  registerDeviceAuthRoutes(
    app,
    serverOptions,
    state,
    membershipStore,
    userStore,
    workspaceStore
  );
  registerDoctorRoutes(app, state, {
    membershipStore,
    projectStore,
    scenarioStore,
    stakeholderInterestStore,
    stepStore,
    useCaseStore
  });
  registerProjectRoutes(
    app,
    state,
    serverOptions.signupStore,
    branchStore,
    membershipStore,
    projectStore,
    workspaceStore
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
  registerBranchTestRoutes(
    app,
    state,
    branchStore,
    projectStore,
    revisionStore,
    useCaseStore
  );
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
    revisionStore,
    workspaceStore
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
    scenarioStore,
    stepStore,
    workSessionStore,
    useCaseStore
  );
  registerInvitationRoutes(
    app,
    options,
    state,
    membershipStore,
    userStore,
    workspaceStore
  );
  registerCommentRoutes(app, state, commentStore, membershipStore, useCaseStore);
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
    stakeholderStore,
    workspaceStore
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
    goalStore,
    membershipStore,
    projectStore,
    revisionStore,
    useCaseStore
  );
  registerUseCaseUpdateRoutes(
    app,
    state,
    branchStore,
    membershipStore,
    projectStore,
    revisionStore,
    stakeholderInterestStore,
    useCaseStore
  );
  registerUseCaseSearchRoutes(
    app,
    state,
    actorStore,
    membershipStore,
    scenarioStore,
    useCaseStore
  );
  registerUseCaseTestRoutes(app, state, useCaseStore);
  registerRevisionDiffRoutes(
    app,
    state,
    branchStore,
    membershipStore,
    revisionStore,
    useCaseStore
  );
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
    actorStore,
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
    actorStore,
    branchStore,
    membershipStore,
    projectStore,
    revisionStore,
    scenarioStore,
    stakeholderInterestStore,
    stakeholderStore,
    stepStore,
    useCaseStore
  );

  return app;
}

function initialState(): SignupState {
  const state: SignupState = {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };

  return state;
}

function withGithubOAuthFromEnv(options: ServerOptions): ServerOptions {
  if (options.authStub || options.githubOAuth !== undefined) {
    return options;
  }
  const githubOAuth = githubOAuthFromEnv();

  return githubOAuth === undefined ? options : { ...options, githubOAuth };
}

function githubOAuthFromEnv(): GithubOAuthConfig | undefined {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (clientId === undefined || clientSecret === undefined) {
    return undefined;
  }

  return { clientId, clientSecret };
}

async function seedStubZeroWorkspaceUser(userStore: UserStore) {
  let existingUser;
  try {
    existingUser = await userStore.findUserByGithubId("stub-zero-workspace-user");
  } catch (error) {
    if (isMissingDatabaseTable(error)) {
      return;
    }

    throw error;
  }

  if (existingUser !== undefined) {
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

function isMissingDatabaseTable(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "P2021";
}
