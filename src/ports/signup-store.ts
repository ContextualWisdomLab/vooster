import type { StoredMembership, StoredUser, StoredWorkspace } from "../http/signup-types.js";

export type SignupEntities = {
  membership: StoredMembership;
  user: StoredUser;
  workspace: StoredWorkspace;
};

export type WorkspaceSummary = {
  id: string;
  role: "EDITOR" | "OWNER";
  slug: string;
};

export type SignupStore = {
  close: () => Promise<void>;
  findUserByGithubId: (githubId: string) => Promise<StoredUser | undefined>;
  saveSignup: (entities: SignupEntities) => Promise<void>;
  updateLastLoginAt: (userId: string, lastLoginAt: string) => Promise<void>;
  workspaceSlugExists: (slug: string) => Promise<boolean>;
  workspaceSummariesForUser: (userId: string) => Promise<WorkspaceSummary[]>;
};
