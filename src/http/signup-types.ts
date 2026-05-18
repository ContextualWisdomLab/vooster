export type ServerOptions = {
  authStub: boolean;
};

export type PendingSignup = {
  name: string;
  slug: string;
};

export type SignupState = {
  pendingSignups: Map<string, PendingSignup>;
  workspaceSlugs: Set<string>;
};

export type GithubProfile = {
  githubId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string;
};
