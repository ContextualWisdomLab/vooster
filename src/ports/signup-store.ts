import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUser,
  StoredWorkspace
} from "../http/signup-types.js";
import type { ActorStore } from "./actor-store.js";
import type { BranchStore } from "./branch-store.js";
import type { GoalStore } from "./goal-store.js";
import type { LockStore } from "./lock-store.js";
import type { MembershipStore } from "./membership-store.js";
import type { MergeRequestStore } from "./merge-request-store.js";
import type { ProjectStore } from "./project-store.js";
import type { ScenarioStore } from "./scenario-store.js";
import type { StakeholderInterestStore } from "./stakeholder-interest-store.js";
import type { StakeholderStore } from "./stakeholder-store.js";
import type { StepStore } from "./step-store.js";
import type { UseCaseStore } from "./usecase-store.js";

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

export type SignupStore = ActorStore &
  BranchStore &
  GoalStore &
  LockStore &
  MembershipStore &
  MergeRequestStore &
  ProjectStore &
  ScenarioStore &
  StakeholderInterestStore &
  StakeholderStore &
  StepStore &
  UseCaseStore & {
  close: () => Promise<void>;
  findUserByGithubId: (githubId: string) => Promise<StoredUser | undefined>;
  saveSignup: (entities: SignupEntities) => Promise<void>;
  saveProjectWithDefaultBranch: (
    project: StoredProject,
    branch: StoredSpecBranch
  ) => Promise<void>;
  updateLastLoginAt: (userId: string, lastLoginAt: string) => Promise<void>;
  workspaceSlugExists: (slug: string) => Promise<boolean>;
  workspaceSummariesForUser: (userId: string) => Promise<WorkspaceSummary[]>;
};
