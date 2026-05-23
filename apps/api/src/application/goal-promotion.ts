import { randomUUID } from "node:crypto";
import type {
  StoredGoal,
  StoredProject,
  StoredRevision,
  StoredUseCase
} from "../domain/entities/index.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type GoalPromotionDeps = {
  goalStore: GoalStore;
  idFactory?: () => string;
  membershipStore?: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type GoalPromotionResult =
  | {
      goal: StoredGoal;
      revision: StoredRevision;
      status: "PROMOTED";
      titleWarning?: { field: "title"; message: string };
      usecase: StoredUseCase;
    }
  | { existingUseCaseKey: string | undefined; status: "ALREADY_PROMOTED" }
  | { goalId: string; status: "PROMOTION_FAILED" | "REJECTED_GOAL" }
  | { status: "FORBIDDEN" | "GOAL_NOT_FOUND" | "PROJECT_NOT_FOUND" };

export async function promoteGoal(
  deps: GoalPromotionDeps,
  input: {
    goalId: string;
    simulateUseCaseInsertFailure?: boolean;
    userId: string | undefined;
  }
): Promise<GoalPromotionResult> {
  const goal = await deps.goalStore.findGoalById(input.goalId);
  if (goal === undefined) {
    return { status: "GOAL_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    deps.membershipStore === undefined ||
    (await deps.membershipStore.membershipForProject(goal.project_id, input.userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }
  return promoteLoadedGoal(deps, {
    goal,
    projectId: goal.project_id,
    simulateUseCaseInsertFailure: input.simulateUseCaseInsertFailure
  });
}

export async function promoteLoadedGoal(
  deps: GoalPromotionDeps,
  input: {
    goal: StoredGoal;
    projectId: string;
    simulateUseCaseInsertFailure?: boolean;
  }
): Promise<GoalPromotionResult> {
  const project = await deps.projectStore.findProjectById(input.projectId);
  if (project === undefined) {
    return { status: "PROJECT_NOT_FOUND" };
  }
  if (input.goal.linked_usecase_id !== null) {
    return {
      existingUseCaseKey: (
        await deps.useCaseStore.findUseCaseById(
          input.projectId,
          input.goal.linked_usecase_id
        )
      )?.key,
      status: "ALREADY_PROMOTED"
    };
  }
  if (input.goal.status === "REJECTED") {
    return { goalId: input.goal.id, status: "REJECTED_GOAL" };
  }
  if (input.simulateUseCaseInsertFailure === true) {
    return { goalId: input.goal.id, status: "PROMOTION_FAILED" };
  }
  return createPromotion(deps, input.goal, project);
}

async function createPromotion(
  deps: GoalPromotionDeps,
  goal: StoredGoal,
  project: StoredProject
): Promise<GoalPromotionResult> {
  const usecase = await seededUseCase(deps, goal, project);
  const revision = useCaseRevision(deps, usecase, `Promoted from goal ${goal.id}`);
  usecase.current_revision_id = revision.id;
  revision.snapshot = { ...usecase };

  goal.status = "PROMOTED";
  goal.linked_usecase_id = usecase.id;
  await deps.useCaseStore.saveUseCase(usecase);
  await deps.revisionStore.saveRevision(revision);
  await deps.goalStore.updateGoal(goal);

  return {
    goal,
    revision,
    status: "PROMOTED",
    usecase,
    ...(titleLooksLikeVerbPhrase(usecase.title) ? {} : { titleWarning: titleWarning() })
  };
}

async function seededUseCase(
  deps: GoalPromotionDeps,
  goal: StoredGoal,
  project: StoredProject
): Promise<StoredUseCase> {
  return {
    archived_at: null,
    current_revision_id: "",
    format: "BRIEF",
    id: idFrom(deps),
    key: await nextUseCaseKey(deps.useCaseStore, project.id, project.key),
    level: goal.level,
    primary_actor_id: goal.actor_id,
    priority: goal.priority,
    project_id: project.id,
    scope: project.key.toLowerCase(),
    status: "DRAFT",
    title: goal.description
  };
}

async function nextUseCaseKey(
  useCaseStore: UseCaseStore,
  projectId: string,
  projectKey: string
): Promise<string> {
  const nextNumber = (await useCaseStore.listUseCases(projectId)).length + 1;
  return `${projectKey}-${String(nextNumber).padStart(3, "0")}`;
}

function useCaseRevision(
  deps: GoalPromotionDeps,
  usecase: StoredUseCase,
  changeSummary: string
): StoredRevision {
  return {
    change_summary: changeSummary,
    entity_id: usecase.id,
    entity_type: "USECASE",
    id: idFrom(deps),
    snapshot: { ...usecase },
    version_number: 1
  };
}

function titleLooksLikeVerbPhrase(title: string): boolean {
  return /^(adds?|approves?|cancels?|creates?|places?|promotes?|renews?|requests?|reviews?|submits?|tracks?|writes?)\b/i.test(
    title
  );
}

function titleWarning() {
  return { field: "title" as const, message: "Title may not be a verb phrase." };
}

function idFrom(deps: GoalPromotionDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
