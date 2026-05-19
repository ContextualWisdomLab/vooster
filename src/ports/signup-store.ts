import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUser,
  StoredWorkspace
} from "../http/signup-types.js";
import type { ActorStore } from "./actor-store.js";

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

export type SignupStore = ActorStore & {
  close: () => Promise<void>;
  findUserByGithubId: (githubId: string) => Promise<StoredUser | undefined>;
  membershipForProject: (
    projectId: string,
    userId: string
  ) => Promise<StoredMembership | undefined>;
  saveSignup: (entities: SignupEntities) => Promise<void>;
  saveProjectWithDefaultBranch: (
    project: StoredProject,
    branch: StoredSpecBranch
  ) => Promise<void>;
  updateLastLoginAt: (userId: string, lastLoginAt: string) => Promise<void>;
  workspaceSlugExists: (slug: string) => Promise<boolean>;
  workspaceSummariesForUser: (userId: string) => Promise<WorkspaceSummary[]>;
};
