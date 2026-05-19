import type { SignupStore } from "../ports/signup-store.js";

export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export type ServerOptions = {
  authStub: boolean;
  githubOAuth?: GithubOAuthConfig;
  signupStore?: SignupStore;
};
export type PendingSignup = {
  name: string;
  slug: string;
};
export type PendingOAuth =
  | { flow: "login" }
  | { flow: "signup"; workspace: PendingSignup };
export type SignupState = {
  pendingOAuth: Map<string, PendingOAuth>;
  readOnlyMemberships: Set<string>;
  sessionsByToken: Map<string, string>;
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
  archived_at: null | string;
};

export type StoredMembership = {
  id: string;
  user_id: string;
  workspace_id: string;
  role: "EDITOR" | "OWNER";
};

export type StoredProject = {
  id: string;
  workspace_id: string;
  name: string;
  key: string;
  visibility: "INTERNAL" | "PRIVATE";
  default_branch_id: string;
};

export type StoredSpecBranch = {
  base_revision_ids?: Record<string, string>;
  id: string;
  project_id: string;
  name: string;
  owner_type: "AGENT" | "HUMAN";
  owner_id: string;
  base_branch_id: null | string;
  head_revision_ids?: Record<string, string>;
  merged_at?: string;
  status?: "ABANDONED" | "ACTIVE" | "MERGED";
};
export type StoredActor = {
  id: string;
  project_id: string;
  name: string;
  type: "OFFSTAGE" | "PRIMARY" | "SUPPORTING";
  description: string;
  is_human: boolean;
  aliases: string[];
  archived_at: null | string;
};
export type StoredRevision = {
  id: string;
  entity_type: "ACTOR" | "GOAL" | "STAKEHOLDER" | "USECASE";
  entity_id: string;
  version_number: number;
  snapshot: StoredActor | StoredGoal | StoredStakeholder | StoredUseCase;
  change_summary?: string;
  branch_id?: string;
  parent_revision_id?: string;
  severity?: "BREAKING" | "COSMETIC" | "NON_BREAKING";
};

export type StoredGoal = {
  id: string;
  project_id: string;
  actor_id: string;
  description: string;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  status: "IDENTIFIED" | "IN_DESIGN" | "PROMOTED" | "REJECTED";
  linked_usecase_id: null | string;
  priority: "P0" | "P1" | "P2" | "P3";
  archived_at: null | string;
};

export type StoredStakeholder = {
  id: string;
  project_id: string;
  name: string;
  type: "EXTERNAL" | "INTERNAL" | "REGULATORY";
  description: string;
  archived_at: null | string;
};

export type StoredStakeholderInterest = {
  id: string;
  usecase_id: string;
  stakeholder_id: string;
  interest: string;
  protection_mechanism: string;
};

export type StoredScenario = {
  id: string;
  usecase_id: string;
  type: "EXTENSION" | "MAIN_SUCCESS";
  extension_point: null | string;
  parent_step_number: null | number;
  condition: null | string;
  outcome: "FAILURE" | "PARTIAL" | "SUCCESS";
  order_index: number;
};

export type StoredStep = {
  id: string;
  scenario_id: string;
  step_number: number;
  actor_id: string;
  action: string;
  is_system_step: boolean;
  notes: null | string;
  order_index: number;
};

export type StoredLock = {
  acquired_at?: string; auto_release?: boolean; expires_at: string;
  held_by_session_id?: null | string; held_by_user_id?: string;
  holder: string; id?: string; lock_type?: "HARD" | "SEMANTIC" | "SOFT";
  mode: "HARD" | "SEMANTIC" | "SOFT"; reason: string;
  target_id?: string; target_type?: "USECASE"; usecase_id: string;
};

export type StoredWorkSession = {
  agent_identifier?: string;
  agent_type?: StoredAgentType;
  branch_id?: null | string;
  ended_at?: string;
  id: string;
  intent?: string;
  last_activity_at?: string;
  pinned_revision_id?: string;
  pinned_revisions?: Record<string, string>;
  project_id?: string;
  started_at?: string;
  status: "ABANDONED" | "ACTIVE" | "COMPLETED";
  usecase_id?: string;
  user_id?: string;
};
export type StoredAgentType = "CLAUDE_CODE" | "CODEX" | "CURSOR" | "HUMAN" | "OTHER" | "WINDSURF";

export type StoredUseCase = {
  id: string;
  project_id: string;
  key: string;
  title: string;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  format: "BRIEF";
  scope: string;
  primary_actor_id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "DRAFT";
  current_revision_id: string;
  archived_at: null | string;
};
