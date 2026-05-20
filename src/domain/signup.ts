export type PendingSignup = {
  name: string;
  slug: string;
};

export type PendingOAuth =
  | { flow: "login" }
  | { flow: "signup"; workspace: PendingSignup };

export type GithubProfile = {
  githubId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string;
};
