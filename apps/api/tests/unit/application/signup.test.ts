import { describe, expect, test } from "vitest";
import {
  completeOAuth,
  startGithubOAuth
} from "../../../src/application/signup.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { SignupStore, WorkspaceSummary } from "../../../src/ports/signup-store.js";
import type { UserStore } from "../../../src/ports/user-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";
import type { GithubProfile } from "../../../src/domain/signup.js";
import type {
  StoredMembership,
  StoredUser,
  StoredWorkspace
} from "../../../src/domain/entities/index.js";

describe("signup application", () => {
  test("starts GitHub OAuth and omits client id for stub auth", () => {
    const started = startGithubOAuth({
      authStub: true,
      idFactory: () => "state-1",
      input: { flow: "login" }
    });

    expect(started).toEqual({
      authorizationUrl: "https://github.com/login/oauth/authorize?state=state-1",
      pending: { flow: "login" },
      state: "state-1"
    });
  });

  test("starts real GitHub OAuth with the configured client id", () => {
    const started = startGithubOAuth({
      authStub: false,
      githubClientId: "client-1",
      idFactory: () => "state-1",
      input: { workspace: { name: "Acme", slug: "acme" } }
    });

    expect(started.authorizationUrl).toContain("state=state-1");
    expect(started.authorizationUrl).toContain("client_id=client-1");
    expect(started.pending).toEqual({
      flow: "signup",
      workspace: { name: "Acme", slug: "acme" }
    });
  });

  test("creates signup entities through the transactional signup store", async () => {
    const saved: Array<{ membership: StoredMembership; user: StoredUser; workspace: StoredWorkspace }> = [];

    const result = await completeOAuth(
      depsFor({
        signupStore: signupStore({ saved })
      }),
      {
        pending: { flow: "signup", workspace: { name: "Acme", slug: "acme" } },
        profile: verifiedProfile()
      }
    );

    expect(result.status).toBe("SIGNED_UP");
    if (result.status !== "SIGNED_UP") {
      throw new Error("expected signup to complete");
    }
    expect(result.user.github_id).toBe("github-1");
    expect(result.workspace).toMatchObject({
      name: "Acme",
      owner_id: result.user.id,
      slug: "acme"
    });
    expect(result.membership).toMatchObject({
      role: "OWNER",
      user_id: result.user.id,
      workspace_id: result.workspace.id
    });
    expect(saved).toEqual([
      {
        membership: result.membership,
        user: result.user,
        workspace: result.workspace
      }
    ]);
  });

  test("rejects duplicate workspace slugs without writing signup entities", async () => {
    const savedUsers: StoredUser[] = [];

    const result = await completeOAuth(
      depsFor({
        savedUsers,
        slugExists: true
      }),
      {
        pending: { flow: "signup", workspace: { name: "Acme", slug: "acme" } },
        profile: verifiedProfile()
      }
    );

    expect(result).toEqual({
      status: "WORKSPACE_SLUG_TAKEN",
      suggestedSlug: "acme-2"
    });
    expect(savedUsers).toEqual([]);
  });

  test("updates returning users and lists workspaces from memberships", async () => {
    const updatedLogins: string[] = [];

    const result = await completeOAuth(
      depsFor({
        memberships: [membership()],
        updatedLogins,
        users: [user()]
      }),
      {
        pending: { flow: "login" },
        profile: verifiedProfile()
      }
    );

    expect(result.status).toBe("LOGGED_IN");
    if (result.status !== "LOGGED_IN") {
      throw new Error("expected login to complete");
    }
    expect(result.user.last_login_at).toBe("2026-05-20T00:00:00.000Z");
    expect(updatedLogins).toEqual(["user-1:2026-05-20T00:00:00.000Z"]);
    expect(result.workspaces).toEqual([
      { id: "workspace-1", role: "OWNER", slug: "acme" }
    ]);
    expect(result.recommendedNextCommand).toBeUndefined();
  });

  test("uses signup store workspace summaries when available", async () => {
    const summaries = [{ id: "workspace-2", role: "EDITOR", slug: "team" }] satisfies WorkspaceSummary[];

    const result = await completeOAuth(
      depsFor({
        signupStore: signupStore({ summaries }),
        users: [user()]
      }),
      {
        pending: { flow: "login" },
        profile: verifiedProfile()
      }
    );

    expect(result.status).toBe("LOGGED_IN");
    if (result.status !== "LOGGED_IN") {
      throw new Error("expected login to complete");
    }
    expect(result.workspaces).toEqual(summaries);
  });

  test("guides known users with no workspaces to create one", async () => {
    const result = await completeOAuth(
      depsFor({ users: [user()] }),
      {
        pending: { flow: "login" },
        profile: verifiedProfile()
      }
    );

    expect(result.status).toBe("LOGGED_IN");
    if (result.status !== "LOGGED_IN") {
      throw new Error("expected login to complete");
    }
    expect(result.workspaces).toEqual([]);
    expect(result.recommendedNextCommand).toBe("vspec workspace create");
  });

  test("rejects unverified profiles and unknown login identities", async () => {
    await expect(
      completeOAuth(depsFor(), {
        pending: { flow: "signup", workspace: { name: "Acme", slug: "acme" } },
        profile: { ...verifiedProfile(), emailVerified: false }
      })
    ).resolves.toEqual({ status: "UNVERIFIED_EMAIL" });

    await expect(
      completeOAuth(depsFor(), {
        pending: { flow: "login" },
        profile: verifiedProfile()
      })
    ).resolves.toEqual({ status: "USER_NOT_FOUND" });
  });
});

function depsFor(options: {
  memberships?: StoredMembership[];
  savedUsers?: StoredUser[];
  signupStore?: SignupStore;
  slugExists?: boolean;
  updatedLogins?: string[];
  users?: StoredUser[];
  workspaces?: StoredWorkspace[];
} = {}) {
  return {
    membershipStore: membershipStore(options.memberships ?? []),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    signupStore: options.signupStore,
    userStore: userStore(options.users ?? [], options.savedUsers ?? [], options.updatedLogins ?? []),
    workspaceStore: workspaceStore(options.slugExists ?? false, options.workspaces ?? [workspace()])
  };
}

function membershipStore(memberships: StoredMembership[]): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve(memberships),
    saveMembership: () => Promise.resolve()
  };
}

function userStore(
  users: StoredUser[],
  savedUsers: StoredUser[],
  updatedLogins: string[]
): UserStore {
  return {
    findUserByEmail: () => Promise.resolve(undefined),
    findUserByGithubId: (githubId) => Promise.resolve(users.find((item) => item.github_id === githubId)),
    saveUser: (newUser) => {
      savedUsers.push(newUser);
      return Promise.resolve();
    },
    updateLastLoginAt: (userId, lastLoginAt) => {
      updatedLogins.push(`${userId}:${lastLoginAt}`);
      return Promise.resolve();
    }
  };
}

function workspaceStore(
  slugExists: boolean,
  workspaces: StoredWorkspace[]
): WorkspaceStore {
  return {
    archiveWorkspace: () => Promise.resolve(),
    findWorkspaceById: (workspaceId) =>
      Promise.resolve(workspaces.find((item) => item.id === workspaceId)),
    isWorkspaceArchived: () => Promise.resolve(false),
    nextAvailableWorkspaceSlug: (slug) => Promise.resolve(`${slug}-2`),
    saveWorkspace: () => Promise.resolve(),
    workspaceSlugExists: () => Promise.resolve(slugExists)
  };
}

function signupStore(options: {
  saved?: Array<{ membership: StoredMembership; user: StoredUser; workspace: StoredWorkspace }>;
  summaries?: WorkspaceSummary[];
}): SignupStore {
  return {
    ...membershipStore([]),
    ...userStore([], [], []),
    ...workspaceStore(false, []),
    archiveActor: () => Promise.resolve(false),
    close: () => Promise.resolve(),
    deleteComment: () => Promise.resolve(),
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    deleteStakeholderInterest: () => Promise.resolve(),
    findActorById: () => Promise.resolve(undefined),
    findActorByName: () => Promise.resolve(undefined),
    findApiKeyById: () => Promise.resolve(undefined),
    findBranchById: () => Promise.resolve(undefined),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    findCommentById: () => Promise.resolve(undefined),
    findGoalById: () => Promise.resolve(undefined),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () => Promise.resolve(undefined),
    findMainScenario: () => Promise.resolve(undefined),
    findMergeRequestById: () => Promise.resolve(undefined),
    findProjectById: () => Promise.resolve(undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    findRevisionById: () => Promise.resolve(undefined),
    findScenarioById: () => Promise.resolve(undefined),
    findStakeholderById: () => Promise.resolve(undefined),
    findStakeholderByName: () => Promise.resolve(undefined),
    findStakeholderInterestById: () => Promise.resolve(undefined),
    findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
    findStepById: () => Promise.resolve(undefined),
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    findWorkSessionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listActors: () => Promise.resolve([]),
    listApiKeysForWorkspace: () => Promise.resolve([]),
    listBranches: () => Promise.resolve([]),
    listCommentsForUseCase: () => Promise.resolve([]),
    listGoals: () => Promise.resolve([]),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve([]),
    listOpenMergeRequests: () => Promise.resolve([]),
    listOpenMergeRequestsByTargetBranchId: () => Promise.resolve([]),
    listProjectsForWorkspace: () => Promise.resolve([]),
    listRevisions: () => Promise.resolve([]),
    listScenarios: () => Promise.resolve([]),
    listStakeholderInterests: () => Promise.resolve([]),
    listStakeholders: () => Promise.resolve([]),
    listSteps: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveActor: () => Promise.resolve(),
    saveApiKey: () => Promise.resolve(),
    saveBranch: () => Promise.resolve(),
    saveComment: () => Promise.resolve(),
    saveGoal: () => Promise.resolve(),
    saveLock: () => Promise.resolve(),
    saveMergeRequest: () => Promise.resolve(),
    deleteProject: () => Promise.resolve("NOT_FOUND" as const),
    updateProjectName: () => Promise.resolve(undefined),
    saveProject: () => Promise.resolve(),
    saveProjectWithDefaultBranch: () => Promise.resolve(),
    saveRevision: () => Promise.resolve(),
    saveScenario: () => Promise.resolve(),
    saveSignup: (entities) => {
      options.saved?.push(entities);
      return Promise.resolve();
    },
    saveStakeholder: () => Promise.resolve(),
    saveStakeholderInterest: () => Promise.resolve(),
    saveStep: () => Promise.resolve(),
    saveUseCase: () => Promise.resolve(),
    saveWorkSession: () => Promise.resolve(),
    updateApiKey: () => Promise.resolve(),
    updateBranch: () => Promise.resolve(),
    updateComment: () => Promise.resolve(),
    updateGoal: () => Promise.resolve(),
    updateLock: () => Promise.resolve(),
    updateMergeRequest: () => Promise.resolve(),
    updateStep: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve(),
    workspaceSummariesForUser: () => Promise.resolve(options.summaries ?? [])
  };
}

function verifiedProfile(): GithubProfile {
  return {
    avatarUrl: "https://github.com/avatar.png",
    email: "user@example.com",
    emailVerified: true,
    githubId: "github-1",
    name: "GitHub User"
  };
}

function user(): StoredUser {
  return {
    avatar_url: "https://github.com/avatar.png",
    email: "user@example.com",
    github_id: "github-1",
    id: "user-1",
    name: "GitHub User"
  };
}

function workspace(): StoredWorkspace {
  return {
    archived_at: null,
    id: "workspace-1",
    name: "Acme",
    owner_id: "user-1",
    plan: "FREE",
    slug: "acme"
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
