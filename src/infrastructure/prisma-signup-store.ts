import { PrismaClient } from "@prisma/client";
import type { SignupEntities, SignupStore, WorkspaceSummary } from "../ports/signup-store.js";
import type { StoredMergeRequest } from "../http/merge-request-types.js";
import type {
  StoredActor,
  StoredGoal,
  StoredMembership,
  StoredProject,
  StoredScenario,
  StoredSpecBranch,
  StoredUser,
  StoredUseCase
} from "../http/signup-types.js";

export function createPrismaSignupStore(databaseUrl: string): SignupStore {
  return new PrismaSignupStore(
    new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    })
  );
}

class PrismaSignupStore implements SignupStore {
  private readonly useCaseCurrentRevisionIds = new Map<string, string>();

  constructor(private readonly prisma: PrismaClient) {}

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async findUserByGithubId(githubId: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { github_id: githubId }
    });

    return user === null ? undefined : storedUser(user);
  }

  async archiveActor(
    projectId: string,
    actorId: string,
    archivedAt: string
  ): Promise<boolean> {
    const result = await this.prisma.actor.updateMany({
      data: { archived_at: new Date(archivedAt) },
      where: { id: actorId, project_id: projectId }
    });

    return result.count > 0;
  }

  async findActorById(
    projectId: string,
    actorId: string
  ): Promise<StoredActor | undefined> {
    const actor = await this.prisma.actor.findFirst({
      where: { id: actorId, project_id: projectId }
    });

    return actor === null ? undefined : storedActor(actor);
  }

  async findActorByName(
    projectId: string,
    name: string
  ): Promise<StoredActor | undefined> {
    const actor = await this.prisma.actor.findUnique({
      where: { project_id_name: { name, project_id: projectId } }
    });

    return actor === null ? undefined : storedActor(actor);
  }

  async findBranchById(branchId: string): Promise<StoredSpecBranch | undefined> {
    const branch = await this.prisma.specBranch.findUnique({
      where: { id: branchId }
    });

    return branch === null ? undefined : storedBranch(branch);
  }

  async findBranchByProjectAndName(
    projectId: string,
    name: string
  ): Promise<StoredSpecBranch | undefined> {
    const branch = await this.prisma.specBranch.findUnique({
      where: {
        project_id_name: {
          name,
          project_id: projectId
        }
      }
    });

    return branch === null ? undefined : storedBranch(branch);
  }

  async findGoalById(goalId: string): Promise<StoredGoal | undefined> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId }
    });

    return goal === null ? undefined : storedGoal(goal);
  }

  async findMergeRequestById(
    mergeRequestId: string
  ): Promise<StoredMergeRequest | undefined> {
    const mergeRequest = await this.prisma.mergeRequest.findUnique({
      where: { id: mergeRequestId }
    });

    return mergeRequest === null ? undefined : storedMergeRequest(mergeRequest);
  }

  async findProjectById(projectId: string): Promise<StoredProject | undefined> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    return project === null ? undefined : storedProject(project);
  }

  async findProjectByWorkspaceAndKey(
    workspaceId: string,
    key: string
  ): Promise<StoredProject | undefined> {
    const project = await this.prisma.project.findUnique({
      where: {
        workspace_id_key: {
          key,
          workspace_id: workspaceId
        }
      }
    });

    return project === null ? undefined : storedProject(project);
  }

  async findUseCaseById(
    projectId: string,
    usecaseId: string
  ): Promise<StoredUseCase | undefined> {
    const usecase = await this.prisma.useCase.findFirst({
      where: { id: usecaseId, project_id: projectId }
    });

    return usecase === null ? undefined : this.storedUseCase(usecase);
  }

  async findUseCaseWithProject(
    usecaseIdOrKey: string
  ): Promise<{ projectId: string; usecase: StoredUseCase } | undefined> {
    const usecase = await this.prisma.useCase.findFirst({
      where: {
        OR: [
          { id: usecaseIdOrKey },
          { key: usecaseIdOrKey }
        ]
      }
    });

    return usecase === null
      ? undefined
      : { projectId: usecase.project_id, usecase: this.storedUseCase(usecase) };
  }

  async findUseCasesByKey(key: string): Promise<StoredUseCase[]> {
    const usecases = await this.prisma.useCase.findMany({
      orderBy: { created_at: "asc" },
      where: { key }
    });

    return usecases.map((usecase) => this.storedUseCase(usecase));
  }

  async findMainScenario(usecaseId: string): Promise<StoredScenario | undefined> {
    const scenario = await this.prisma.scenario.findFirst({
      where: { type: "MAIN_SUCCESS", usecase_id: usecaseId }
    });

    return scenario === null ? undefined : storedScenario(scenario);
  }

  async findScenarioById(scenarioId: string): Promise<StoredScenario | undefined> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    return scenario === null ? undefined : storedScenario(scenario);
  }

  async listActors(projectId: string): Promise<StoredActor[]> {
    const actors = await this.prisma.actor.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return actors.map(storedActor);
  }

  async listBranches(projectId: string): Promise<StoredSpecBranch[]> {
    const branches = await this.prisma.specBranch.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return branches.map(storedBranch);
  }

  async listGoals(projectId: string): Promise<StoredGoal[]> {
    const goals = await this.prisma.goal.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return goals.map(storedGoal);
  }

  async listScenarios(usecaseId: string): Promise<StoredScenario[]> {
    const scenarios = await this.prisma.scenario.findMany({
      orderBy: { order_index: "asc" },
      where: { usecase_id: usecaseId }
    });

    return scenarios.map(storedScenario);
  }

  async listUseCases(projectId: string): Promise<StoredUseCase[]> {
    const usecases = await this.prisma.useCase.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return usecases.map((usecase) => this.storedUseCase(usecase));
  }

  async listOpenMergeRequests(): Promise<StoredMergeRequest[]> {
    const mergeRequests = await this.prisma.mergeRequest.findMany({
      orderBy: { created_at: "asc" },
      where: { status: "OPEN" }
    });

    return mergeRequests.map(storedMergeRequest);
  }

  async listOpenMergeRequestsByTargetBranchId(
    targetBranchId: string
  ): Promise<StoredMergeRequest[]> {
    const mergeRequests = await this.prisma.mergeRequest.findMany({
      orderBy: { created_at: "asc" },
      where: { status: "OPEN", target_branch_id: targetBranchId }
    });

    return mergeRequests.map(storedMergeRequest);
  }

  async listProjectsForWorkspace(workspaceId: string): Promise<StoredProject[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: { created_at: "asc" },
      where: { workspace_id: workspaceId }
    });

    return projects.map(storedProject);
  }

  async membershipForProject(
    projectId: string,
    userId: string
  ): Promise<StoredMembership | undefined> {
    const project = await this.prisma.project.findUnique({
      select: { workspace_id: true },
      where: { id: projectId }
    });
    if (project === null) {
      return undefined;
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: project.workspace_id
        }
      }
    });

    return membership === null ? undefined : storedMembership(membership);
  }

  async membershipForWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<StoredMembership | undefined> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId
        }
      }
    });

    return membership === null ? undefined : storedMembership(membership);
  }

  async membershipsForUser(userId: string): Promise<StoredMembership[]> {
    const memberships = await this.prisma.membership.findMany({
      orderBy: { id: "asc" },
      where: { user_id: userId }
    });

    return memberships.map(storedMembership);
  }

  async saveSignup(entities: SignupEntities): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.create({
        data: entities.user
      }),
      this.prisma.workspace.create({
        data: entities.workspace
      }),
      this.prisma.membership.create({
        data: entities.membership
      })
    ]);
  }

  async saveActor(actor: StoredActor): Promise<void> {
    await this.prisma.actor.create({
      data: {
        ...actor,
        aliases: JSON.stringify(actor.aliases),
        archived_at: dateOrNull(actor.archived_at)
      }
    });
  }

  async saveBranch(branch: StoredSpecBranch): Promise<void> {
    await this.prisma.specBranch.create({ data: specBranchData(branch) });
  }

  async saveGoal(goal: StoredGoal): Promise<void> {
    await this.prisma.goal.create({ data: goalData(goal) });
  }

  async saveMembership(membership: StoredMembership): Promise<void> {
    await this.prisma.membership.create({ data: membership });
  }

  async saveProject(project: StoredProject): Promise<void> {
    await this.prisma.project.create({
      data: projectData(project)
    });
  }

  async saveScenario(scenario: StoredScenario): Promise<void> {
    await this.prisma.scenario.create({
      data: scenarioData(scenario)
    });
  }

  async saveUseCase(usecase: StoredUseCase): Promise<void> {
    await this.prisma.useCase.create({
      data: useCaseData(usecase)
    });
    this.rememberUseCaseCurrentRevision(usecase);
  }

  async saveMergeRequest(mergeRequest: StoredMergeRequest): Promise<void> {
    await this.prisma.mergeRequest.create({
      data: mergeRequestData(mergeRequest)
    });
  }

  async saveProjectWithDefaultBranch(
    project: StoredProject,
    branch: StoredSpecBranch
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.project.create({
        data: { ...projectData(project), default_branch_id: null }
      }),
      this.prisma.specBranch.create({
        data: {
          base_branch_id: branch.base_branch_id,
          id: branch.id,
          name: branch.name,
          owner_id: branch.owner_id,
          owner_type: branch.owner_type,
          project_id: branch.project_id
        }
      }),
      this.prisma.project.update({
        data: { default_branch_id: branch.id },
        where: { id: project.id }
      })
    ]);
  }

  async updateBranch(branch: StoredSpecBranch): Promise<void> {
    await this.prisma.specBranch.update({
      data: specBranchUpdate(branch),
      where: { id: branch.id }
    });
  }

  async updateGoal(goal: StoredGoal): Promise<void> {
    await this.prisma.goal.update({
      data: goalUpdate(goal),
      where: { id: goal.id }
    });
  }

  async updateMergeRequest(mergeRequest: StoredMergeRequest): Promise<void> {
    await this.prisma.mergeRequest.update({
      data: mergeRequestUpdate(mergeRequest),
      where: { id: mergeRequest.id }
    });
  }

  async updateUseCase(usecase: StoredUseCase): Promise<void> {
    await this.prisma.useCase.update({
      data: useCaseUpdate(usecase),
      where: { id: usecase.id }
    });
    this.rememberUseCaseCurrentRevision(usecase);
  }

  async updateLastLoginAt(userId: string, lastLoginAt: string): Promise<void> {
    await this.prisma.user.update({
      data: { last_login_at: new Date(lastLoginAt) },
      where: { id: userId }
    });
  }

  async workspaceSlugExists(slug: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      select: { id: true },
      where: { slug }
    });

    return workspace !== null;
  }

  async workspaceSummariesForUser(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      include: {
        workspace: true
      },
      where: { user_id: userId }
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      role: storedMembership(membership).role,
      slug: membership.workspace.slug
    }));
  }

  private rememberUseCaseCurrentRevision(usecase: StoredUseCase): void {
    if (usecase.current_revision_id !== "") {
      this.useCaseCurrentRevisionIds.set(usecase.id, usecase.current_revision_id);
    }
  }

  private storedUseCase(usecase: Parameters<typeof storedUseCase>[0]): StoredUseCase {
    const stored = storedUseCase(usecase);
    return {
      ...stored,
      current_revision_id:
        this.useCaseCurrentRevisionIds.get(stored.id) ?? stored.current_revision_id
    };
  }
}

function storedGoal(goal: {
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

function storedMergeRequest(mergeRequest: {
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

function storedBranch(branch: {
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

function storedProject(project: {
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

function storedScenario(scenario: {
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

function storedUseCase(usecase: {
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

function storedActor(actor: {
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

function storedUser(user: {
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

function storedMembership(membership: {
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

function dateOrNull(value: null | string): Date | null {
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

function parseRecord(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string"
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
    Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string"
    )
  );
}

function specBranchData(branch: StoredSpecBranch) {
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

function projectData(project: StoredProject) {
  return {
    default_branch_id: project.default_branch_id === "" ? null : project.default_branch_id,
    id: project.id,
    key: project.key,
    name: project.name,
    visibility: project.visibility,
    workspace_id: project.workspace_id
  };
}

function scenarioData(scenario: StoredScenario) {
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

function useCaseData(usecase: StoredUseCase) {
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

function useCaseUpdate(usecase: StoredUseCase) {
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

function specBranchUpdate(branch: StoredSpecBranch) {
  return {
    base_revision_ids: JSON.stringify(branch.base_revision_ids ?? {}),
    head_revision_ids: JSON.stringify(branch.head_revision_ids ?? {}),
    merged_at: dateOrUndefined(branch.merged_at),
    status: branch.status ?? "ACTIVE"
  };
}

function goalData(goal: StoredGoal) {
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

function goalUpdate(goal: StoredGoal) {
  return {
    archived_at: dateOrNull(goal.archived_at),
    status: goal.status
  };
}

function mergeRequestData(mergeRequest: StoredMergeRequest) {
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

function mergeRequestUpdate(mergeRequest: StoredMergeRequest) {
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
