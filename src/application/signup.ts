import { randomUUID } from "node:crypto";
import type { MembershipStore } from "../ports/membership-store.js";
import type { SignupStore, WorkspaceSummary } from "../ports/signup-store.js";
import type { UserStore } from "../ports/user-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";
import type { GithubProfile, PendingOAuth, PendingSignup } from "../domain/signup.js";
import type {
  StoredMembership,
  StoredUser,
  StoredWorkspace
} from "../domain/entities/index.js";

export type StartGithubOAuthInput = { flow: "login" } | { workspace: PendingSignup };

export type StartGithubOAuthOptions = {
  authStub: boolean;
  githubClientId?: string;
  idFactory?: () => string;
  input: StartGithubOAuthInput;
};

export type StartGithubOAuthResult = {
  authorizationUrl: string;
  pending: PendingOAuth;
  state: string;
};

export type SignupApplicationDeps = {
  membershipStore: MembershipStore;
  now?: () => Date;
  signupStore?: SignupStore;
  userStore: UserStore;
  workspaceStore: WorkspaceStore;
};

export type CompleteOAuthInput = { pending: PendingOAuth; profile: GithubProfile };

export type CompleteOAuthResult =
  | {
      membership: StoredMembership;
      status: "SIGNED_UP";
      user: StoredUser;
      workspace: StoredWorkspace;
    }
  | {
      recommendedNextCommand?: "vspec workspace create";
      status: "LOGGED_IN";
      user: StoredUser;
      workspaces: WorkspaceSummary[];
    }
  | { status: "UNVERIFIED_EMAIL" | "USER_NOT_FOUND" }
  | { status: "WORKSPACE_SLUG_TAKEN"; suggestedSlug: string };

export function startGithubOAuth(options: StartGithubOAuthOptions): StartGithubOAuthResult {
  const state = (options.idFactory ?? randomUUID)();
  const pending = pendingOAuth(options.input);
  return {
    authorizationUrl: authorizationUrl(options, state),
    pending,
    state
  };
}

export async function completeOAuth(
  deps: SignupApplicationDeps,
  input: CompleteOAuthInput
): Promise<CompleteOAuthResult> {
  if (!input.profile.emailVerified) {
    return { status: "UNVERIFIED_EMAIL" };
  }
  return input.pending.flow === "login"
    ? completeLogin(deps, input.profile)
    : completeSignup(deps, input.profile, input.pending.workspace);
}

async function completeSignup(
  deps: SignupApplicationDeps,
  profile: GithubProfile,
  pending: PendingSignup
): Promise<CompleteOAuthResult> {
  if (await deps.workspaceStore.workspaceSlugExists(pending.slug)) {
    return {
      status: "WORKSPACE_SLUG_TAKEN",
      suggestedSlug: await deps.workspaceStore.nextAvailableWorkspaceSlug(pending.slug)
    };
  }

  const entities = signupEntities(profile, pending);
  if (deps.signupStore === undefined) {
    await deps.userStore.saveUser(entities.user);
    await deps.membershipStore.saveMembership(entities.membership);
    await deps.workspaceStore.saveWorkspace(entities.workspace);
  } else {
    await deps.signupStore.saveSignup(entities);
  }

  return {
    membership: entities.membership,
    status: "SIGNED_UP",
    user: entities.user,
    workspace: entities.workspace
  };
}

async function completeLogin(deps: SignupApplicationDeps, profile: GithubProfile): Promise<CompleteOAuthResult> {
  const user = await deps.userStore.findUserByGithubId(profile.githubId);
  if (user === undefined) {
    return { status: "USER_NOT_FOUND" };
  }

  user.last_login_at = (deps.now ?? (() => new Date()))().toISOString();
  await deps.userStore.updateLastLoginAt(user.id, user.last_login_at);
  const workspaces = deps.signupStore === undefined
    ? await workspacesForUser(deps.membershipStore, deps.workspaceStore, user.id)
    : await deps.signupStore.workspaceSummariesForUser(user.id);

  return {
    ...(workspaces.length === 0
      ? { recommendedNextCommand: "vspec workspace create" as const }
      : {}),
    status: "LOGGED_IN",
    user,
    workspaces
  };
}

async function workspacesForUser(
  membershipStore: MembershipStore,
  workspaceStore: WorkspaceStore,
  userId: string
): Promise<WorkspaceSummary[]> {
  const memberships = await membershipStore.membershipsForUser(userId);
  const summaries = await Promise.all(
    memberships.map(async (membership) => {
      const workspace = await workspaceStore.findWorkspaceById(membership.workspace_id);
      return workspace === undefined
        ? undefined
        : { id: workspace.id, role: membership.role, slug: workspace.slug };
    })
  );

  return summaries.filter((summary): summary is WorkspaceSummary => summary !== undefined);
}

function pendingOAuth(input: StartGithubOAuthInput): PendingOAuth {
  return "flow" in input ? { flow: "login" } : { flow: "signup", workspace: input.workspace };
}

function authorizationUrl(options: StartGithubOAuthOptions, state: string): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("state", state);

  if (!options.authStub) {
    url.searchParams.set("client_id", options.githubClientId ?? "");
  }

  return url.toString();
}

function signupEntities(profile: GithubProfile, pending: PendingSignup) {
  const user: StoredUser = {
    avatar_url: profile.avatarUrl,
    email: profile.email,
    github_id: profile.githubId,
    id: randomUUID(),
    name: profile.name
  };
  const workspace = workspaceFor(pending, user.id);

  return {
    membership: ownerMembership(user.id, workspace.id),
    user,
    workspace
  };
}

function workspaceFor(pending: PendingSignup, ownerId: string): StoredWorkspace {
  return {
    archived_at: null,
    id: randomUUID(),
    name: pending.name,
    owner_id: ownerId,
    plan: "FREE",
    slug: pending.slug
  };
}

function ownerMembership(userId: string, workspaceId: string): StoredMembership {
  return {
    id: randomUUID(),
    role: "OWNER",
    user_id: userId,
    workspace_id: workspaceId
  };
}
