import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUser,
  StoredWorkspace
} from "../http/signup-types.js";
import type { ActorStore } from "./actor-store.js";
import type { BranchStore } from "./branch-store.js";

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

export type SignupStore = ActorStore & BranchStore & {
  close: () => Promise<void>;
  findProjectById: (projectId: string) => Promise<StoredProject | undefined>;
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
