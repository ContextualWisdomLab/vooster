import { PrismaClient } from "@prisma/client";
import type { SignupEntities, SignupStore, WorkspaceSummary } from "../ports/signup-store.js";
import {
  apiKeyData,
  apiKeyUpdate,
  commentData,
  commentUpdate,
  dateOrNull,
  goalData,
  goalUpdate,
  lockData,
  lockUpdate,
  mergeRequestData,
  mergeRequestUpdate,
  projectData,
  revisionContentHash,
  revisionProjectId,
  scenarioData,
  specBranchData,
  specBranchUpdate,
  stakeholderData,
  stakeholderInterestData,
  stepData,
  stepUpdate,
  storedActor,
  storedApiKey,
  storedBranch,
  storedComment,
  storedGoal,
  storedLock,
  storedMembership,
  storedMergeRequest,
  storedProject,
  storedRevision,
  storedScenario,
  storedStakeholder,
  storedStakeholderInterest,
  storedStep,
  storedUseCase,
  storedUser,
  storedWorkspace,
  storedWorkSession,
  useCaseData,
  useCaseUpdate,
  workSessionData,
  workSessionUpdate,
  workspaceData
} from "./prisma-signup-mappers.js";
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

  async findApiKeyById(apiKeyId: string): Promise<StoredApiKey | undefined> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId }
    });

    return apiKey === null ? undefined : storedApiKey(apiKey);
  }

  async findCommentById(commentId: string): Promise<StoredComment | undefined> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId }
    });

    return comment === null ? undefined : storedComment(comment);
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

  async listApiKeysForWorkspace(workspaceId: string): Promise<StoredApiKey[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      orderBy: { created_at: "asc" },
      where: { workspace_id: workspaceId }
    });

    return apiKeys.map(storedApiKey);
  }

  async listCommentsForUseCase(usecaseId: string): Promise<StoredComment[]> {
    const comments = await this.prisma.comment.findMany({
      orderBy: { created_at: "asc" },
      where: { target_id: usecaseId, target_type: "USECASE" }
    });

    return comments.map(storedComment);
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

  async updateActor(actor: StoredActor): Promise<void> {
    await this.prisma.actor.update({
      data: {
        aliases: JSON.stringify(actor.aliases),
        archived_at: dateOrNull(actor.archived_at),
        description: actor.description,
        is_human: actor.is_human,
        name: actor.name,
        type: actor.type
      },
      where: { id: actor.id }
    });
  }

  async saveBranch(branch: StoredSpecBranch): Promise<void> {
    await this.prisma.specBranch.create({ data: specBranchData(branch) });
  }

  async saveApiKey(apiKey: StoredApiKey): Promise<void> {
    await this.prisma.apiKey.create({ data: apiKeyData(apiKey) });
  }

  async saveComment(comment: StoredComment): Promise<void> {
    await this.prisma.comment.create({ data: commentData(comment) });
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

  async updateStakeholder(stakeholder: StoredStakeholder): Promise<void> {
    await this.prisma.stakeholder.update({
      data: stakeholderData(stakeholder),
      where: { id: stakeholder.id }
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

  async deleteComment(commentId: string): Promise<void> {
    await this.prisma.comment.deleteMany({
      where: { id: commentId }
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

  async updateComment(comment: StoredComment): Promise<void> {
    await this.prisma.comment.update({
      data: commentUpdate(comment),
      where: { id: comment.id }
    });
  }

  async updateApiKey(apiKey: StoredApiKey): Promise<void> {
    await this.prisma.apiKey.update({
      data: apiKeyUpdate(apiKey),
      where: { id: apiKey.id }
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

  async nextAvailableWorkspaceSlug(slug: string): Promise<string> {
    let suffix = 2;
    let candidate = `${slug}-${String(suffix)}`;

    while (await this.workspaceSlugExists(candidate)) {
      suffix += 1;
      candidate = `${slug}-${String(suffix)}`;
    }

    return candidate;
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
