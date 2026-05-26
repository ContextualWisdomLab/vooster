import { randomUUID } from "node:crypto";
import type {
  StoredActor,
  StoredGoal,
  StoredRevision
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export const allowedGoalStatusTransitions = [
  "IDENTIFIED -> IN_DESIGN",
  "IN_DESIGN -> PROMOTED",
  "any -> REJECTED"
];

export type ActorGoalsDeps = {
  actorStore: ActorStore;
  goalStore: GoalStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  workspaceStore: WorkspaceStore;
};

export type CreateGoalInput = {
  actorId?: string;
  actorName?: string;
  description: string;
  dryRun?: boolean;
  level: StoredGoal["level"];
  priority: StoredGoal["priority"];
  projectId: string;
  userId?: string;
};

export type CreateGoalResult =
  | {
      duplicateGoalId?: string;
      goal: StoredGoal;
      revision: StoredRevision;
      status: "CREATED";
    }
  | { actorId: string; status: "ACTOR_UNAVAILABLE" }
  | { status: "FORBIDDEN" | "WORKSPACE_ARCHIVED" };

export type PatchGoalInput = {
  goalId: string;
  status?: StoredGoal["status"];
  userId?: string;
};

export type PatchGoalResult =
  | { goal: StoredGoal; revision: StoredRevision; status: "PATCHED" }
  | {
      status:
        | "FORBIDDEN"
        | "GOAL_NOT_FOUND"
        | "ILLEGAL_STATUS_TRANSITION"
        | "PROMOTED_REJECT_REQUIRES_ARCHIVE"
        | "WORKSPACE_ARCHIVED";
    };

export type ListGoalsResult =
  | { actors: Array<{ actor: StoredActor; goals: StoredGoal[] }>; status: "LISTED" }
  | { status: "FORBIDDEN" };

export async function createGoal(
  deps: ActorGoalsDeps,
  input: CreateGoalInput
): Promise<CreateGoalResult> {
  const access = await projectAccess(deps, input.projectId, input.userId);
  if (access !== "OK") {
    return { status: access };
  }

  const actor = await resolveActor(deps.actorStore, input);
  if (actor === undefined || actor.archived_at !== null) {
    return {
      actorId: input.actorName ?? input.actorId ?? "",
      status: "ACTOR_UNAVAILABLE"
    };
  }

  const goal = {
    actor_id: actor.id,
    archived_at: null,
    description: input.description,
    id: idFrom(deps),
    level: input.level,
    linked_usecase_id: null,
    priority: input.priority,
    project_id: input.projectId,
    status: "IDENTIFIED" as const
  };
  const duplicateGoal = nearDuplicateGoal(
    await deps.goalStore.listGoals(input.projectId),
    actor.id,
    goal.description
  );
  const revision = goalRevision(deps, goal, 1);

  if (input.dryRun !== true) {
    await deps.goalStore.saveGoal(goal);
    await deps.revisionStore.saveRevision(revision);
  }

  return { duplicateGoalId: duplicateGoal?.id, goal, revision, status: "CREATED" };
}

export async function patchGoal(
  deps: ActorGoalsDeps,
  input: PatchGoalInput
): Promise<PatchGoalResult> {
  const goal = await deps.goalStore.findGoalById(input.goalId);
  if (goal === undefined) {
    return { status: "GOAL_NOT_FOUND" };
  }
  const access = await projectAccess(deps, goal.project_id, input.userId);
  if (access !== "OK") {
    return { status: access };
  }
  if (input.status !== undefined && !canTransition(goal.status, input.status)) {
    return { status: "ILLEGAL_STATUS_TRANSITION" };
  }
  if (goal.status === "PROMOTED" && input.status === "REJECTED") {
    return { status: "PROMOTED_REJECT_REQUIRES_ARCHIVE" };
  }

  if (input.status !== undefined) {
    goal.status = input.status;
  }
  const revision = goalRevision(
    deps,
    goal,
    await deps.revisionStore.nextVersionNumber(goal.id)
  );
  await deps.revisionStore.saveRevision(revision);
  await deps.goalStore.updateGoal(goal);
  return { goal, revision, status: "PATCHED" };
}

export async function listGoals(
  deps: Pick<ActorGoalsDeps, "actorStore" | "goalStore" | "membershipStore">,
  input: { actorId?: string; projectId: string; userId?: string }
): Promise<ListGoalsResult> {
  if (
    !(await hasProjectMembership(deps.membershipStore, input.projectId, input.userId))
  ) {
    return { status: "FORBIDDEN" };
  }
  const actors = (await deps.actorStore.listActors(input.projectId)).filter(
    (actor) =>
      actor.archived_at === null &&
      (input.actorId === undefined || actor.id === input.actorId)
  );
  const goals = await deps.goalStore.listGoals(input.projectId);
  return {
    actors: actors.map((actor) => ({
      actor,
      goals: goals.filter((goal) => goal.actor_id === actor.id)
    })),
    status: "LISTED"
  };
}

async function resolveActor(
  actorStore: ActorStore,
  input: CreateGoalInput
): Promise<StoredActor | undefined> {
  if (input.actorName !== undefined) {
    return actorStore.findActorByName(input.projectId, input.actorName);
  }
  if (input.actorId !== undefined) {
    return actorStore.findActorById(input.projectId, input.actorId);
  }
  return undefined;
}

function canTransition(from: StoredGoal["status"], to: StoredGoal["status"]): boolean {
  return (
    from === to ||
    to === "REJECTED" ||
    (from === "IDENTIFIED" && to === "IN_DESIGN") ||
    (from === "IN_DESIGN" && to === "PROMOTED")
  );
}

function goalRevision(
  deps: Pick<ActorGoalsDeps, "idFactory">,
  goal: StoredGoal,
  versionNumber: number
): StoredRevision {
  return {
    entity_id: goal.id,
    entity_type: "GOAL",
    id: idFrom(deps),
    snapshot: { ...goal },
    version_number: versionNumber
  };
}

function nearDuplicateGoal(
  goals: StoredGoal[],
  actorId: string,
  description: string
): StoredGoal | undefined {
  const normalized = comparableDescription(description);
  return goals.find(
    (goal) =>
      goal.actor_id === actorId &&
      comparableDescription(goal.description) === normalized
  );
}

async function projectAccess(
  deps: Pick<ActorGoalsDeps, "membershipStore" | "projectStore" | "workspaceStore">,
  projectId: string,
  userId: string | undefined
): Promise<"FORBIDDEN" | "OK" | "WORKSPACE_ARCHIVED"> {
  if (!(await hasProjectMembership(deps.membershipStore, projectId, userId))) {
    return "FORBIDDEN";
  }
  const project = await deps.projectStore.findProjectById(projectId);
  return project !== undefined &&
    (await deps.workspaceStore.isWorkspaceArchived(project.workspace_id))
    ? "WORKSPACE_ARCHIVED"
    : "OK";
}

async function hasProjectMembership(
  membershipStore: MembershipStore,
  projectId: string,
  userId: string | undefined
): Promise<boolean> {
  return (
    userId !== undefined &&
    (await membershipStore.membershipForProject(projectId, userId)) !== undefined
  );
}

function comparableDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.replace(/s$/, ""))
    .join(" ");
}

function idFrom(deps: Pick<ActorGoalsDeps, "idFactory">): string {
  return (deps.idFactory ?? randomUUID)();
}
