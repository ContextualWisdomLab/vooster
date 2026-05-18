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
  actorsByProjectId: Map<string, StoredActor[]>;
  branchesById: Map<string, StoredSpecBranch>;
  goalsByProjectId: Map<string, StoredGoal[]>;
  membershipsByUserId: Map<string, StoredMembership[]>;
  pendingOAuth: Map<string, PendingOAuth>;
  projectKeysByWorkspaceId: Map<string, Map<string, string>>;
  projectsById: Map<string, StoredProject>;
  readOnlyMemberships: Set<string>;
  sessionsByToken: Map<string, string>;
  scenariosByUseCaseId: Map<string, StoredScenario[]>;
  stakeholderInterestsByUseCaseId: Map<string, StoredStakeholderInterest[]>;
  stepsByScenarioId: Map<string, StoredStep[]>;
  revisionsByEntityId: Map<string, StoredRevision[]>;
  stakeholdersByProjectId: Map<string, StoredStakeholder[]>;
  usecasesByProjectId: Map<string, StoredUseCase[]>;
  usersByGithubId: Map<string, StoredUser>;
  workspaceArchivedAt: Map<string, string>;
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

export type StoredProject = {
  id: string;
  workspace_id: string;
  name: string;
  key: string;
  visibility: "INTERNAL" | "PRIVATE";
  default_branch_id: string;
};

export type StoredSpecBranch = {
  id: string;
  project_id: string;
  name: "main";
  owner_type: "HUMAN";
  owner_id: string;
  base_branch_id: null;
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
  severity?: "BREAKING" | "NON_BREAKING";
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
