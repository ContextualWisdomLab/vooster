export type ServerOptions = {
  authStub: boolean;
};

export type PendingSignup = {
  name: string;
  slug: string;
};

export type PendingOAuth =
  | { flow: "login" }
  | { flow: "signup"; workspace: PendingSignup };

export type SignupState = {
  membershipsByUserId: Map<string, StoredMembership[]>;
  pendingOAuth: Map<string, PendingOAuth>;
  usersByGithubId: Map<string, StoredUser>;
  workspacesById: Map<string, StoredWorkspace>;
  workspaceSlugs: Set<string>;
};

export type GithubProfile = {
  githubId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string;
};

export type StoredUser = {
  id: string;
  github_id: string;
  email: string;
  name: string;
  avatar_url: string;
  last_login_at?: string;
};

export type StoredWorkspace = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "FREE";
};

export type StoredMembership = {
  id: string;
  user_id: string;
  workspace_id: string;
  role: "OWNER";
};
