import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { SignupEntities, SignupStore, WorkspaceSummary } from "../ports/signup-store.js";
import type { StoredMergeRequest } from "../http/merge-request-types.js";
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

  async archiveWorkspace(workspaceId: string, archivedAt: string): Promise<void> {
    await this.prisma.workspace.update({
      data: { archived_at: new Date(archivedAt) },
      where: { id: workspaceId }
    });
  }

  async findWorkspaceById(workspaceId: string): Promise<StoredWorkspace | undefined> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    return workspace === null ? undefined : storedWorkspace(workspace);
  }

  async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    return user === null ? undefined : storedUser(user);
  }

  async findWorkSessionById(sessionId: string): Promise<StoredWorkSession | undefined> {
    const session = await this.prisma.workSession.findUnique({
      where: { id: sessionId }
    });

    return session === null ? undefined : storedWorkSession(session);
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

  async findLockById(lockId: string): Promise<StoredLock | undefined> {
    const lock = await this.prisma.lock.findUnique({
      where: { id: lockId }
    });

    return lock === null ? undefined : storedLock(lock);
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

    return usecase === null ? undefined : storedUseCase(usecase);
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
      : { projectId: usecase.project_id, usecase: storedUseCase(usecase) };
  }

  async findUseCasesByKey(key: string): Promise<StoredUseCase[]> {
    const usecases = await this.prisma.useCase.findMany({
      orderBy: { created_at: "asc" },
      where: { key }
    });

    return usecases.map(storedUseCase);
  }

  async findMainScenario(usecaseId: string): Promise<StoredScenario | undefined> {
    const scenario = await this.prisma.scenario.findFirst({
      where: { type: "MAIN_SUCCESS", usecase_id: usecaseId }
    });

    return scenario === null ? undefined : storedScenario(scenario);
  }

  async findLockForUseCase(usecaseId: string): Promise<StoredLock | undefined> {
    const lock = await this.prisma.lock.findFirst({
      orderBy: { acquired_at: "desc" },
      where: { target_id: usecaseId, target_type: "USECASE" }
    });

    return lock === null ? undefined : storedLock(lock);
  }

  async findScenarioById(scenarioId: string): Promise<StoredScenario | undefined> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    return scenario === null ? undefined : storedScenario(scenario);
  }

  async findStakeholderById(
    projectId: string,
    stakeholderId: string
  ): Promise<StoredStakeholder | undefined> {
    const stakeholder = await this.prisma.stakeholder.findFirst({
      where: { id: stakeholderId, project_id: projectId }
    });

    return stakeholder === null ? undefined : storedStakeholder(stakeholder);
  }

  async findStakeholderByName(
    projectId: string,
    name: string
  ): Promise<StoredStakeholder | undefined> {
    const stakeholder = await this.prisma.stakeholder.findUnique({
      where: { project_id_name: { name, project_id: projectId } }
    });

    return stakeholder === null ? undefined : storedStakeholder(stakeholder);
  }

  async findStakeholderInterestById(
    usecaseId: string,
    interestId: string
  ): Promise<StoredStakeholderInterest | undefined> {
    const interest = await this.prisma.stakeholderInterest.findFirst({
      where: { id: interestId, usecase_id: usecaseId }
    });

    return interest === null ? undefined : storedStakeholderInterest(interest);
  }

  async findStakeholderInterestForStakeholder(
    usecaseId: string,
    stakeholderId: string
  ): Promise<StoredStakeholderInterest | undefined> {
    const interest = await this.prisma.stakeholderInterest.findUnique({
      where: { usecase_id_stakeholder_id: { stakeholder_id: stakeholderId, usecase_id: usecaseId } }
    });

    return interest === null ? undefined : storedStakeholderInterest(interest);
  }

  async findStepById(stepId: string): Promise<StoredStep | undefined> {
    const step = await this.prisma.step.findUnique({
      where: { id: stepId }
    });

    return step === null ? undefined : storedStep(step);
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

  async listLocksForUseCase(usecaseId: string): Promise<StoredLock[]> {
    const locks = await this.prisma.lock.findMany({
      orderBy: { acquired_at: "asc" },
      where: { target_id: usecaseId, target_type: "USECASE" }
    });

    return locks.map(storedLock);
  }

  async listLocksHeldBySession(sessionId: string): Promise<StoredLock[]> {
    const locks = await this.prisma.lock.findMany({
      orderBy: { acquired_at: "asc" },
      where: { held_by_session_id: sessionId }
    });

    return locks.map(storedLock);
  }

  async listScenarios(usecaseId: string): Promise<StoredScenario[]> {
    const scenarios = await this.prisma.scenario.findMany({
      orderBy: { order_index: "asc" },
      where: { usecase_id: usecaseId }
    });

    return scenarios.map(storedScenario);
  }

  async listStakeholders(projectId: string): Promise<StoredStakeholder[]> {
    const stakeholders = await this.prisma.stakeholder.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return stakeholders.map(storedStakeholder);
  }

  async listStakeholderInterests(
    usecaseId: string
  ): Promise<StoredStakeholderInterest[]> {
    const interests = await this.prisma.stakeholderInterest.findMany({
      orderBy: { created_at: "asc" },
      where: { usecase_id: usecaseId }
    });

    return interests.map(storedStakeholderInterest);
  }

  async listSteps(scenarioId: string): Promise<StoredStep[]> {
    const steps = await this.prisma.step.findMany({
      orderBy: [{ order_index: "asc" }, { step_number: "asc" }],
      where: { scenario_id: scenarioId }
    });

    return steps.map(storedStep);
  }

  async listUseCases(projectId: string): Promise<StoredUseCase[]> {
    const usecases = await this.prisma.useCase.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return usecases.map(storedUseCase);
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

  async listRevisions(entityId: string): Promise<StoredRevision[]> {
    const revisions = await this.prisma.revision.findMany({
      orderBy: { version_number: "asc" },
      where: { entity_id: entityId }
    });

    return revisions.map(storedRevision);
  }

  async listWorkSessions(): Promise<StoredWorkSession[]> {
    const sessions = await this.prisma.workSession.findMany({
      orderBy: { started_at: "desc" }
    });

    return sessions.map(storedWorkSession);
  }

  async listWorkSessionsForUseCase(usecaseId: string): Promise<StoredWorkSession[]> {
    return (await this.listWorkSessions()).filter((session) =>
      session.usecase_id === usecaseId ||
      session.pinned_revisions?.[usecaseId] !== undefined
    );
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
        data: workspaceData(entities.workspace)
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

  async saveLock(lock: StoredLock): Promise<void> {
    await this.ensureLockSession(lock);
    await this.prisma.lock.create({ data: lockData(lock) });
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

  async saveStakeholder(stakeholder: StoredStakeholder): Promise<void> {
    await this.prisma.stakeholder.create({
      data: stakeholderData(stakeholder)
    });
  }

  async saveStakeholderInterest(
    interest: StoredStakeholderInterest
  ): Promise<void> {
    await this.prisma.stakeholderInterest.create({
      data: stakeholderInterestData(interest)
    });
  }

  async saveStep(step: StoredStep): Promise<void> {
    await this.prisma.step.create({
      data: stepData(step)
    });
  }

  async saveUseCase(usecase: StoredUseCase): Promise<void> {
    await this.prisma.useCase.create({
      data: useCaseData(usecase)
    });
  }

  async saveMergeRequest(mergeRequest: StoredMergeRequest): Promise<void> {
    await this.prisma.mergeRequest.create({
      data: mergeRequestData(mergeRequest)
    });
  }

  async deleteLock(lockId: string): Promise<void> {
    await this.prisma.lock.deleteMany({
      where: { id: lockId }
    });
  }

  async deleteLockForUseCase(usecaseId: string): Promise<void> {
    await this.prisma.lock.deleteMany({
      where: { target_id: usecaseId, target_type: "USECASE" }
    });
  }

  async deleteStakeholderInterest(interestId: string): Promise<void> {
    await this.prisma.stakeholderInterest.deleteMany({
      where: { id: interestId }
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

  async saveRevision(revision: StoredRevision): Promise<void> {
    const context = await this.revisionContext(revision);
    const parentRevisionId = await this.persistedParentRevisionId(revision);
    await this.prisma.revision.create({
      data: {
        author_id: context.authorId,
        branch_id: context.branchId,
        change_summary: revision.change_summary,
        content_hash: revisionContentHash(revision),
        entity_id: revision.entity_id,
        entity_type: revision.entity_type,
        id: revision.id,
        parent_revision_id: parentRevisionId,
        severity: revision.severity,
        snapshot: JSON.stringify(revision.snapshot),
        version_number: revision.version_number
      }
    });
    if (revision.entity_type === "USECASE" && context.advancesDefaultHead) {
      await this.prisma.useCase.update({
        data: { current_revision_id: revision.id },
        where: { id: revision.entity_id }
      });
    }
  }

  async saveUser(user: StoredUser): Promise<void> {
    await this.prisma.user.create({ data: user });
  }

  async saveWorkspace(workspace: StoredWorkspace): Promise<void> {
    await this.prisma.workspace.create({ data: workspaceData(workspace) });
  }

  async saveWorkSession(session: StoredWorkSession): Promise<void> {
    await this.prisma.workSession.create({ data: workSessionData(session) });
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

  async updateLock(lock: StoredLock): Promise<void> {
    await this.ensureLockSession(lock);
    await this.prisma.lock.update({
      data: lockUpdate(lock),
      where: { id: lock.id ?? lock.usecase_id }
    });
  }

  async updateMergeRequest(mergeRequest: StoredMergeRequest): Promise<void> {
    await this.prisma.mergeRequest.update({
      data: mergeRequestUpdate(mergeRequest),
      where: { id: mergeRequest.id }
    });
  }

  async updateStep(step: StoredStep): Promise<void> {
    await this.prisma.step.update({
      data: stepUpdate(step),
      where: { id: step.id }
    });
  }

  async updateUseCase(usecase: StoredUseCase): Promise<void> {
    await this.prisma.useCase.update({
      data: useCaseUpdate(usecase),
      where: { id: usecase.id }
    });
  }

  async updateWorkSession(session: StoredWorkSession): Promise<void> {
    await this.prisma.workSession.update({
      data: workSessionUpdate(session),
      where: { id: session.id }
    });
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

  async isWorkspaceArchived(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      select: { archived_at: true },
      where: { id: workspaceId }
    });

    return workspace?.archived_at !== null && workspace?.archived_at !== undefined;
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

  async findRevisionById(revisionId: string): Promise<StoredRevision | undefined> {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId }
    });

    return revision === null ? undefined : storedRevision(revision);
  }

  async latestRevision(entityId: string): Promise<StoredRevision | undefined> {
    const revision = await this.prisma.revision.findFirst({
      orderBy: { version_number: "desc" },
      where: { entity_id: entityId }
    });

    return revision === null ? undefined : storedRevision(revision);
  }

  async nextVersionNumber(entityId: string): Promise<number> {
    const latest = await this.latestRevision(entityId);
    return (latest?.version_number ?? 0) + 1;
  }

  private async persistedParentRevisionId(
    revision: StoredRevision
  ): Promise<string | null> {
    if (revision.parent_revision_id === undefined) {
      return null;
    }

    return await this.prisma.revision.findUnique({
      select: { id: true },
      where: { id: revision.parent_revision_id }
    }) === null
      ? null
      : revision.parent_revision_id;
  }

  private async revisionContext(
    revision: StoredRevision
  ): Promise<{ advancesDefaultHead: boolean; authorId: string; branchId: string }> {
    const projectId = revisionProjectId(revision);
    const project = await this.prisma.project.findUnique({
      select: {
        default_branch_id: true,
        workspace: { select: { owner_id: true } }
      },
      where: { id: projectId }
    });
    if (project?.default_branch_id === null || project?.default_branch_id === undefined) {
      throw new Error(`Missing default branch for revision ${revision.id}`);
    }
    const branchId = revision.branch_id ?? project.default_branch_id;

    return {
      advancesDefaultHead: branchId === project.default_branch_id,
      authorId: project.workspace.owner_id,
      branchId
    };
  }

  private async ensureLockSession(lock: StoredLock): Promise<void> {
    if (lock.held_by_session_id === null || lock.held_by_session_id === undefined) {
      return;
    }
    const usecase = await this.prisma.useCase.findUnique({
      select: { project_id: true },
      where: { id: lock.target_id ?? lock.usecase_id }
    });
    if (usecase === null) {
      return;
    }
    await this.prisma.workSession.upsert({
      create: {
        id: lock.held_by_session_id,
        intent: "Hold use case lock",
        project_id: usecase.project_id,
        user_id: lock.held_by_user_id ?? lock.holder
      },
      update: {},
      where: { id: lock.held_by_session_id }
    });
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

function storedLock(lock: {
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

function storedStakeholder(stakeholder: {
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

function storedStakeholderInterest(interest: {
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

function storedStep(step: {
  action: string;
  actor_id: string;
  id: string;
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
    is_system_step: step.is_system_step,
    notes: step.notes,
    order_index: step.order_index,
    scenario_id: step.scenario_id,
    step_number: step.step_number
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

function storedRevision(revision: {
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

function storedWorkSession(session: {
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

function storedRevisionSeverity(value: null | string | undefined): StoredRevision["severity"] {
  if (value === "BREAKING" || value === "COSMETIC" || value === "NON_BREAKING") {
    return value;
  }

  return undefined;
}

function revisionContentHash(revision: StoredRevision): string {
  return createHash("sha256")
    .update(JSON.stringify(revision.snapshot))
    .digest("hex");
}

function revisionProjectId(revision: StoredRevision): string {
  return revision.snapshot.project_id;
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

function storedWorkspace(workspace: {
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

function workspaceData(workspace: StoredWorkspace) {
  return {
    archived_at: dateOrNull(workspace.archived_at),
    id: workspace.id,
    name: workspace.name,
    owner_id: workspace.owner_id,
    plan: workspace.plan,
    slug: workspace.slug
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

function stakeholderData(stakeholder: StoredStakeholder) {
  return {
    archived_at: dateOrNull(stakeholder.archived_at),
    description: stakeholder.description,
    id: stakeholder.id,
    name: stakeholder.name,
    project_id: stakeholder.project_id,
    type: stakeholder.type
  };
}

function stakeholderInterestData(interest: StoredStakeholderInterest) {
  return {
    id: interest.id,
    interest: interest.interest,
    protection_mechanism:
      interest.protection_mechanism === "" ? null : interest.protection_mechanism,
    stakeholder_id: interest.stakeholder_id,
    usecase_id: interest.usecase_id
  };
}

function stepData(step: StoredStep) {
  return {
    action: step.action,
    actor_id: step.actor_id,
    id: step.id,
    is_system_step: step.is_system_step,
    notes: step.notes,
    order_index: step.order_index,
    scenario_id: step.scenario_id,
    step_number: step.step_number
  };
}

function stepUpdate(step: StoredStep) {
  return {
    action: step.action,
    actor_id: step.actor_id,
    is_system_step: step.is_system_step,
    notes: step.notes,
    order_index: step.order_index,
    step_number: step.step_number
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

function workSessionData(session: StoredWorkSession) {
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

function workSessionUpdate(session: StoredWorkSession) {
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

function lockData(lock: StoredLock) {
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

function lockUpdate(lock: StoredLock) {
  return {
    auto_release: lock.auto_release ?? true,
    expires_at: new Date(lock.expires_at),
    reason: lock.reason
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
