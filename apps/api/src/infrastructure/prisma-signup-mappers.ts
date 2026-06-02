import { createHash } from "node:crypto";
import type { StoredApiKey } from "../domain/entities/index.js";
import type { StoredComment } from "../domain/entities/index.js";
import type { StoredMergeRequest } from "../domain/entities/index.js";
import type {
  StoredActor,
  StoredGoal,
  StoredLock,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredScenario,
  StoredSpecBranch,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredStep,
  StoredUser,
  StoredUseCase,
  StoredWorkspace,
  StoredWorkSession
} from "../domain/entities/index.js";

export function storedGoal(goal: {
  actor_id: string;
  archived_at: Date | null;
  description: string;
  id: string;
  level: string;
  linked_usecase_id: null | string;
  priority: string;
  project_id: string;
  status: string;
}): StoredGoal {
  return {
    actor_id: goal.actor_id,
    archived_at: goal.archived_at?.toISOString() ?? null,
    description: goal.description,
    id: goal.id,
    level: storedUseCaseLevel(goal.level),
    linked_usecase_id: goal.linked_usecase_id,
    priority: storedPriority(goal.priority),
    project_id: goal.project_id,
    status: storedGoalStatus(goal.status)
  };
}

export function storedLock(lock: {
  acquired_at: Date;
  auto_release: boolean;
  expires_at: Date;
  held_by_session_id: null | string;
  held_by_user_id: string;
  id: string;
  lock_type: string;
  reason: string;
  target_id: string;
  target_type: string;
}): StoredLock {
  const mode = storedLockType(lock.lock_type);
  return {
    acquired_at: lock.acquired_at.toISOString(),
    auto_release: lock.auto_release,
    expires_at: lock.expires_at.toISOString(),
    held_by_session_id: lock.held_by_session_id,
    held_by_user_id: lock.held_by_user_id,
    holder: lock.held_by_session_id ?? lock.held_by_user_id,
    id: lock.id,
    lock_type: mode,
    mode,
    reason: lock.reason,
    target_id: lock.target_id,
    target_type: lock.target_type === "USECASE" ? "USECASE" : undefined,
    usecase_id: lock.target_id
  };
}

export function storedMergeRequest(mergeRequest: {
  conflicts: string;
  created_by: string;
  id: string;
  impact: string;
  resolved_at: Date | null;
  source_branch_id: string;
  status: string;
  strategy: string;
  target_branch_id: string;
}): StoredMergeRequest {
  const payload = parseMergeRequestPayload(mergeRequest.impact);

  return {
    conflicts: parseConflicts(mergeRequest.conflicts),
    created_by: mergeRequest.created_by,
    current_revision_id: payload.current_revision_id,
    id: mergeRequest.id,
    impact: payload.impact,
    resolved_at: mergeRequest.resolved_at?.toISOString(),
    source_branch_id: mergeRequest.source_branch_id,
    status: storedMergeRequestStatus(mergeRequest.status),
    strategy: storedMergeStrategy(mergeRequest.strategy),
    target_branch_id: mergeRequest.target_branch_id
  };
}

function parseMergeRequestPayload(raw: string): {
  current_revision_id?: string;
  impact: StoredMergeRequest["impact"];
} {
  const parsed = JSON.parse(raw) as unknown;
  if (isRecord(parsed) && isRecord(parsed.impact)) {
    return {
      current_revision_id:
        typeof parsed.current_revision_id === "string"
          ? parsed.current_revision_id
          : undefined,
      impact: storedMergeImpact(parsed.impact)
    };
  }

  return { impact: storedMergeImpact(parsed) };
}

function storedMergeImpact(raw: unknown): StoredMergeRequest["impact"] {
  if (!isRecord(raw)) {
    return emptyMergeImpact();
  }

  return {
    affected_branches: stringArray(raw.affected_branches),
    affected_sessions: stringArray(raw.affected_sessions),
    severity_by_entity: stringRecord(raw.severity_by_entity)
  };
}

function parseConflicts(raw: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isRecord);
}

export function storedBranch(branch: {
  base_branch_id: null | string;
  base_revision_ids: string;
  head_revision_ids: string;
  id: string;
  merged_at: Date | null;
  name: string;
  owner_id: string;
  owner_type: string;
  project_id: string;
  status: string;
}): StoredSpecBranch {
  return {
    base_branch_id: branch.base_branch_id,
    base_revision_ids: parseRecord(branch.base_revision_ids),
    head_revision_ids: parseRecord(branch.head_revision_ids),
    id: branch.id,
    merged_at: branch.merged_at?.toISOString(),
    name: branch.name,
    owner_id: branch.owner_id,
    owner_type: storedOwnerType(branch.owner_type),
    project_id: branch.project_id,
    status: storedBranchStatus(branch.status)
  };
}

export function storedProject(project: {
  default_branch_id: null | string;
  id: string;
  key: string;
  name: string;
  visibility: string;
  workspace_id: string;
}): StoredProject {
  return {
    default_branch_id: project.default_branch_id ?? "",
    id: project.id,
    key: project.key,
    name: project.name,
    visibility: project.visibility === "INTERNAL" ? "INTERNAL" : "PRIVATE",
    workspace_id: project.workspace_id
  };
}

export function storedScenario(scenario: {
  condition: null | string;
  extension_point: null | string;
  id: string;
  order_index: number;
  outcome: string;
  parent_step_number: null | number;
  type: string;
  usecase_id: string;
}): StoredScenario {
  return {
    condition: scenario.condition,
    extension_point: scenario.extension_point,
    id: scenario.id,
    order_index: scenario.order_index,
    outcome: storedScenarioOutcome(scenario.outcome),
    parent_step_number: scenario.parent_step_number,
    type: scenario.type === "EXTENSION" ? "EXTENSION" : "MAIN_SUCCESS",
    usecase_id: scenario.usecase_id
  };
}

export function storedStakeholder(stakeholder: {
  archived_at: Date | null;
  description: null | string;
  id: string;
  name: string;
  project_id: string;
  type: string;
}): StoredStakeholder {
  return {
    archived_at: stakeholder.archived_at?.toISOString() ?? null,
    description: stakeholder.description ?? "",
    id: stakeholder.id,
    name: stakeholder.name,
    project_id: stakeholder.project_id,
    type: storedStakeholderType(stakeholder.type)
  };
}

export function storedStakeholderInterest(interest: {
  id: string;
  interest: string;
  protection_mechanism: null | string;
  stakeholder_id: string;
  usecase_id: string;
}): StoredStakeholderInterest {
  return {
    id: interest.id,
    interest: interest.interest,
    protection_mechanism: interest.protection_mechanism ?? "",
    stakeholder_id: interest.stakeholder_id,
    usecase_id: interest.usecase_id
  };
}

export function storedStep(step: {
  action: string;
  actor_id: string;
  id: string;
  implements?: string[];
  invokes?: string[];
  is_system_step: boolean;
  notes: null | string;
  order_index: number;
  scenario_id: string;
  step_number: number;
}): StoredStep {
  return {
    action: step.action,
    actor_id: step.actor_id,
    id: step.id,
    implements: step.implements ?? [],
    invokes: step.invokes ?? [],
    is_system_step: step.is_system_step,
    notes: step.notes,
    order_index: step.order_index,
    scenario_id: step.scenario_id,
    step_number: step.step_number
  };
}

export function storedUseCase(usecase: {
  archived_at: Date | null;
  current_revision_id: null | string;
  format: string;
  id: string;
  key: string;
  level: string;
  primary_actor_id: string;
  priority: string;
  project_id: string;
  scope: string;
  status: string;
  title: string;
}): StoredUseCase {
  return {
    archived_at: usecase.archived_at?.toISOString() ?? null,
    current_revision_id: usecase.current_revision_id ?? "",
    format: "BRIEF",
    id: usecase.id,
    key: usecase.key,
    level: storedUseCaseLevel(usecase.level),
    primary_actor_id: usecase.primary_actor_id,
    priority: storedPriority(usecase.priority),
    project_id: usecase.project_id,
    scope: usecase.scope,
    status: "DRAFT",
    title: usecase.title
  };
}

export function storedRevision(revision: {
  branch_id: string;
  change_summary: null | string;
  entity_id: string;
  entity_type: string;
  id: string;
  parent_revision_id: null | string;
  severity?: null | string;
  snapshot: string;
  version_number: number;
}): StoredRevision {
  return {
    branch_id: revision.branch_id,
    change_summary: revision.change_summary ?? undefined,
    entity_id: revision.entity_id,
    entity_type: storedRevisionEntityType(revision.entity_type),
    id: revision.id,
    parent_revision_id: revision.parent_revision_id ?? undefined,
    severity: storedRevisionSeverity(revision.severity),
    snapshot: JSON.parse(revision.snapshot) as StoredRevision["snapshot"],
    version_number: revision.version_number
  };
}

export function storedWorkSession(session: {
  agent_identifier: null | string;
  agent_type: string;
  branch_id: null | string;
  ended_at: Date | null;
  id: string;
  intent: string;
  last_activity_at?: Date | null;
  pinned_revisions: string;
  project_id: string;
  started_at: Date;
  status: string;
  user_id: string;
}): StoredWorkSession {
  return {
    agent_identifier: session.agent_identifier ?? undefined,
    agent_type: storedAgentType(session.agent_type),
    branch_id: session.branch_id,
    ended_at: session.ended_at?.toISOString(),
    id: session.id,
    intent: session.intent,
    last_activity_at: session.last_activity_at?.toISOString(),
    pinned_revisions: parseRecord(session.pinned_revisions),
    project_id: session.project_id,
    started_at: session.started_at.toISOString(),
    status: storedWorkSessionStatus(session.status),
    user_id: session.user_id
  };
}

function storedAgentType(value: string): StoredWorkSession["agent_type"] {
  if (
    value === "CLAUDE_CODE" ||
    value === "CODEX" ||
    value === "CURSOR" ||
    value === "HUMAN" ||
    value === "OTHER" ||
    value === "WINDSURF"
  ) {
    return value;
  }

  return "OTHER";
}

function storedWorkSessionStatus(value: string): StoredWorkSession["status"] {
  if (value === "ABANDONED" || value === "COMPLETED") {
    return value;
  }

  return "ACTIVE";
}

function storedRevisionEntityType(value: string): StoredRevision["entity_type"] {
  if (
    value === "ACTOR" ||
    value === "GOAL" ||
    value === "STAKEHOLDER" ||
    value === "USECASE"
  ) {
    return value;
  }

  throw new Error(`Unknown revision entity type ${value}`);
}

function storedRevisionSeverity(
  value: null | string | undefined
): StoredRevision["severity"] {
  if (value === "BREAKING" || value === "COSMETIC" || value === "NON_BREAKING") {
    return value;
  }

  return undefined;
}

export function revisionContentHash(revision: StoredRevision): string {
  return createHash("sha256").update(JSON.stringify(revision.snapshot)).digest("hex");
}

export function revisionProjectId(revision: StoredRevision): string {
  return revision.snapshot.project_id;
}

export function storedActor(actor: {
  aliases: string;
  archived_at: Date | null;
  description: null | string;
  id: string;
  is_human: boolean;
  name: string;
  project_id: string;
  type: string;
}): StoredActor {
  return {
    aliases: parseAliases(actor.aliases),
    archived_at: actor.archived_at?.toISOString() ?? null,
    description: actor.description ?? "",
    id: actor.id,
    is_human: actor.is_human,
    name: actor.name,
    project_id: actor.project_id,
    type: storedActorType(actor.type)
  };
}

export function storedUser(user: {
  avatar_url: null | string;
  email: string;
  github_id: string;
  id: string;
  last_login_at: Date | null;
  name: null | string;
}): StoredUser {
  return {
    avatar_url: user.avatar_url ?? "",
    email: user.email,
    github_id: user.github_id,
    id: user.id,
    last_login_at: user.last_login_at?.toISOString(),
    name: user.name ?? ""
  };
}

export function storedComment(comment: {
  author_id: string;
  body: string;
  created_at: Date;
  id: string;
  resolved: boolean;
  resolved_at: Date | null;
  target_id: string;
  target_type: string;
  updated_at?: Date | null;
}): StoredComment {
  return {
    author_id: comment.author_id,
    body: comment.body,
    created_at: comment.created_at.toISOString(),
    id: comment.id,
    resolved: comment.resolved,
    resolved_at: comment.resolved_at?.toISOString() ?? null,
    target_id: comment.target_id,
    target_type: "USECASE",
    updated_at: comment.updated_at?.toISOString() ?? null
  };
}

export function storedApiKey(apiKey: {
  created_at: Date;
  id: string;
  key_hash: string;
  name: string;
  revoked_at: Date | null;
  scopes: string;
  user_id: string;
  workspace_id: string;
}): StoredApiKey {
  return {
    created_at: apiKey.created_at.toISOString(),
    created_by: apiKey.user_id,
    id: apiKey.id,
    name: apiKey.name,
    revoked_at: apiKey.revoked_at?.toISOString() ?? null,
    scopes: parseApiKeyScopes(apiKey.scopes),
    token_hash: apiKey.key_hash,
    workspace_id: apiKey.workspace_id
  };
}

export function storedWorkspace(workspace: {
  archived_at: Date | null;
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  slug: string;
}): StoredWorkspace {
  return {
    archived_at: workspace.archived_at?.toISOString() ?? null,
    id: workspace.id,
    name: workspace.name,
    owner_id: workspace.owner_id,
    plan: "FREE",
    slug: workspace.slug
  };
}

export function storedMembership(membership: {
  id: string;
  role: string;
  user_id: string;
  workspace_id: string;
}): StoredMembership {
  return {
    id: membership.id,
    role: membership.role === "OWNER" ? "OWNER" : "EDITOR",
    user_id: membership.user_id,
    workspace_id: membership.workspace_id
  };
}

export function dateOrNull(value: null | string): Date | null {
  return value === null ? null : new Date(value);
}

function dateOrUndefined(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

function parseAliases(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")
    ? parsed
    : [];
}

function parseApiKeyScopes(raw: string): StoredApiKey["scopes"] {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter(
        (scope): scope is "read" | "write" => scope === "read" || scope === "write"
      )
    : [];
}

function parseRecord(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

export function specBranchData(branch: StoredSpecBranch) {
  return {
    base_branch_id: branch.base_branch_id,
    base_revision_ids: JSON.stringify(branch.base_revision_ids ?? {}),
    head_revision_ids: JSON.stringify(branch.head_revision_ids ?? {}),
    id: branch.id,
    merged_at: dateOrUndefined(branch.merged_at),
    name: branch.name,
    owner_id: branch.owner_id,
    owner_type: branch.owner_type,
    project_id: branch.project_id,
    status: branch.status ?? "ACTIVE"
  };
}

export function apiKeyData(apiKey: StoredApiKey) {
  return {
    created_at: dateOrUndefined(apiKey.created_at),
    id: apiKey.id,
    key_hash: apiKey.token_hash,
    name: apiKey.name,
    revoked_at: dateOrNull(apiKey.revoked_at),
    scopes: JSON.stringify(apiKey.scopes),
    user_id: apiKey.created_by,
    workspace_id: apiKey.workspace_id
  };
}

export function projectData(project: StoredProject) {
  return {
    default_branch_id:
      project.default_branch_id === "" ? null : project.default_branch_id,
    id: project.id,
    key: project.key,
    name: project.name,
    visibility: project.visibility,
    workspace_id: project.workspace_id
  };
}

export function workspaceData(workspace: StoredWorkspace) {
  return {
    archived_at: dateOrNull(workspace.archived_at),
    id: workspace.id,
    name: workspace.name,
    owner_id: workspace.owner_id,
    plan: workspace.plan,
    slug: workspace.slug
  };
}

export function commentData(comment: StoredComment) {
  return {
    author_id: comment.author_id,
    body: comment.body,
    created_at: dateOrUndefined(comment.created_at),
    id: comment.id,
    resolved: comment.resolved,
    resolved_at: dateOrNull(comment.resolved_at),
    target_id: comment.target_id,
    target_type: comment.target_type,
    updated_at: dateOrNull(comment.updated_at)
  };
}

export function scenarioData(scenario: StoredScenario) {
  return {
    condition: scenario.condition,
    extension_point: scenario.extension_point,
    id: scenario.id,
    order_index: scenario.order_index,
    outcome: scenario.outcome,
    parent_step_number: scenario.parent_step_number,
    type: scenario.type,
    usecase_id: scenario.usecase_id
  };
}

export function stakeholderData(stakeholder: StoredStakeholder) {
  return {
    archived_at: dateOrNull(stakeholder.archived_at),
    description: stakeholder.description,
    id: stakeholder.id,
    name: stakeholder.name,
    project_id: stakeholder.project_id,
    type: stakeholder.type
  };
}

export function stakeholderInterestData(interest: StoredStakeholderInterest) {
  return {
    id: interest.id,
    interest: interest.interest,
    protection_mechanism:
      interest.protection_mechanism === "" ? null : interest.protection_mechanism,
    stakeholder_id: interest.stakeholder_id,
    usecase_id: interest.usecase_id
  };
}

export function stepData(step: StoredStep) {
  return {
    action: step.action,
    actor_id: step.actor_id,
    id: step.id,
    implements: step.implements,
    invokes: step.invokes,
    is_system_step: step.is_system_step,
    notes: step.notes,
    order_index: step.order_index,
    scenario_id: step.scenario_id,
    step_number: step.step_number
  };
}

export function stepUpdate(step: StoredStep) {
  return {
    action: step.action,
    actor_id: step.actor_id,
    implements: step.implements,
    invokes: step.invokes,
    is_system_step: step.is_system_step,
    notes: step.notes,
    order_index: step.order_index,
    step_number: step.step_number
  };
}

export function useCaseData(usecase: StoredUseCase) {
  return {
    archived_at: dateOrNull(usecase.archived_at),
    current_revision_id: null,
    format: usecase.format,
    id: usecase.id,
    key: usecase.key,
    level: usecase.level,
    minimal_guarantee: "",
    preconditions: "[]",
    primary_actor_id: usecase.primary_actor_id,
    priority: usecase.priority,
    project_id: usecase.project_id,
    scope: usecase.scope,
    status: usecase.status,
    success_guarantee: "",
    title: usecase.title,
    trigger: ""
  };
}

export function useCaseUpdate(usecase: StoredUseCase) {
  return {
    archived_at: dateOrNull(usecase.archived_at),
    format: usecase.format,
    level: usecase.level,
    priority: usecase.priority,
    scope: usecase.scope,
    status: usecase.status,
    title: usecase.title
  };
}

export function workSessionData(session: StoredWorkSession) {
  if (session.project_id === undefined || session.user_id === undefined) {
    throw new Error(`Work session ${session.id} requires project_id and user_id`);
  }
  return {
    agent_identifier: session.agent_identifier ?? null,
    agent_type: session.agent_type ?? "OTHER",
    branch_id: session.branch_id ?? null,
    ended_at: dateOrNull(session.ended_at ?? null),
    id: session.id,
    intent: session.intent ?? "",
    last_activity_at: dateOrNull(session.last_activity_at ?? null),
    pinned_revisions: JSON.stringify(session.pinned_revisions ?? {}),
    project_id: session.project_id,
    started_at: dateOrUndefined(session.started_at),
    status: session.status,
    user_id: session.user_id
  };
}

export function workSessionUpdate(session: StoredWorkSession) {
  return {
    agent_identifier: session.agent_identifier ?? null,
    agent_type: session.agent_type ?? "OTHER",
    branch_id: session.branch_id ?? null,
    ended_at: dateOrNull(session.ended_at ?? null),
    intent: session.intent ?? "",
    last_activity_at: dateOrNull(session.last_activity_at ?? null),
    pinned_revisions: JSON.stringify(session.pinned_revisions ?? {}),
    started_at: dateOrUndefined(session.started_at),
    status: session.status
  };
}

export function commentUpdate(comment: StoredComment) {
  return {
    body: comment.body,
    resolved: comment.resolved,
    resolved_at: dateOrNull(comment.resolved_at),
    updated_at: dateOrNull(comment.updated_at)
  };
}

export function apiKeyUpdate(apiKey: StoredApiKey) {
  return {
    revoked_at: dateOrNull(apiKey.revoked_at)
  };
}

export function specBranchUpdate(branch: StoredSpecBranch) {
  return {
    base_revision_ids: JSON.stringify(branch.base_revision_ids ?? {}),
    head_revision_ids: JSON.stringify(branch.head_revision_ids ?? {}),
    merged_at: dateOrUndefined(branch.merged_at),
    status: branch.status ?? "ACTIVE"
  };
}

export function goalData(goal: StoredGoal) {
  return {
    actor_id: goal.actor_id,
    archived_at: dateOrNull(goal.archived_at),
    description: goal.description,
    id: goal.id,
    level: goal.level,
    linked_usecase_id: goal.linked_usecase_id,
    priority: goal.priority,
    project_id: goal.project_id,
    status: goal.status
  };
}

export function lockData(lock: StoredLock) {
  return {
    acquired_at: dateOrUndefined(lock.acquired_at),
    auto_release: lock.auto_release ?? true,
    expires_at: new Date(lock.expires_at),
    held_by_session_id: lock.held_by_session_id ?? null,
    held_by_user_id: lock.held_by_user_id ?? lock.holder,
    id: lock.id,
    lock_type: lock.lock_type ?? lock.mode,
    reason: lock.reason,
    target_id: lock.target_id ?? lock.usecase_id,
    target_type: lock.target_type ?? "USECASE"
  };
}

export function lockUpdate(lock: StoredLock) {
  return {
    auto_release: lock.auto_release ?? true,
    expires_at: new Date(lock.expires_at),
    reason: lock.reason
  };
}

export function goalUpdate(goal: StoredGoal) {
  return {
    archived_at: dateOrNull(goal.archived_at),
    status: goal.status
  };
}

export function mergeRequestData(mergeRequest: StoredMergeRequest) {
  return {
    conflicts: JSON.stringify(mergeRequest.conflicts),
    created_by: mergeRequest.created_by ?? "",
    id: mergeRequest.id,
    impact: mergeRequestPayload(mergeRequest),
    resolved_at: dateOrUndefined(mergeRequest.resolved_at),
    source_branch_id: mergeRequest.source_branch_id ?? "",
    status: mergeRequest.status,
    strategy: mergeRequest.strategy,
    target_branch_id: mergeRequest.target_branch_id
  };
}

export function mergeRequestUpdate(mergeRequest: StoredMergeRequest) {
  return {
    conflicts: JSON.stringify(mergeRequest.conflicts),
    impact: mergeRequestPayload(mergeRequest),
    resolved_at: dateOrUndefined(mergeRequest.resolved_at),
    status: mergeRequest.status
  };
}

function mergeRequestPayload(mergeRequest: StoredMergeRequest): string {
  return JSON.stringify({
    current_revision_id: mergeRequest.current_revision_id,
    impact: mergeRequest.impact
  });
}

function emptyMergeImpact(): StoredMergeRequest["impact"] {
  return {
    affected_branches: [],
    affected_sessions: [],
    severity_by_entity: {}
  };
}

function storedBranchStatus(status: string): StoredSpecBranch["status"] {
  return status === "ABANDONED" || status === "MERGED" ? status : "ACTIVE";
}

function storedOwnerType(ownerType: string): StoredSpecBranch["owner_type"] {
  return ownerType === "AGENT" ? "AGENT" : "HUMAN";
}

function storedActorType(type: string): StoredActor["type"] {
  return type === "OFFSTAGE" || type === "SUPPORTING" ? type : "PRIMARY";
}

function storedStakeholderType(type: string): StoredStakeholder["type"] {
  return type === "EXTERNAL" || type === "REGULATORY" ? type : "INTERNAL";
}

function storedGoalStatus(status: string): StoredGoal["status"] {
  return status === "IN_DESIGN" || status === "PROMOTED" || status === "REJECTED"
    ? status
    : "IDENTIFIED";
}

function storedPriority(priority: string): StoredGoal["priority"] {
  return priority === "P0" || priority === "P1" || priority === "P3" ? priority : "P2";
}

function storedUseCaseLevel(level: string): StoredGoal["level"] {
  return level === "SUMMARY" || level === "SUBFUNCTION" ? level : "USER_GOAL";
}

function storedScenarioOutcome(outcome: string): StoredScenario["outcome"] {
  return outcome === "FAILURE" || outcome === "PARTIAL" ? outcome : "SUCCESS";
}

function storedMergeRequestStatus(status: string): StoredMergeRequest["status"] {
  return status === "CLOSED" || status === "MERGED" ? status : "OPEN";
}

function storedMergeStrategy(strategy: string): StoredMergeRequest["strategy"] {
  return strategy === "SQUASH" ? "SQUASH" : "FAST_FORWARD";
}

function storedLockType(lockType: string): StoredLock["mode"] {
  return lockType === "HARD" || lockType === "SOFT" ? lockType : "SEMANTIC";
}
