import type { SignupStore } from "../ports/signup-store.js";
import type { PendingOAuth } from "../domain/signup.js";

export type { GithubProfile, PendingOAuth, PendingSignup } from "../domain/signup.js";

export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export type ServerOptions = {
  authStub: boolean;
  githubOAuth?: GithubOAuthConfig;
  signupStore?: SignupStore;
};
export type SignupState = {
  pendingOAuth: Map<string, PendingOAuth>;
  readOnlyMemberships: Set<string>;
  sessionsByToken: Map<string, string>;
};
