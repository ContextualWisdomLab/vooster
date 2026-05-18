import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SignupState, StoredActor, StoredGoal } from "./signup-types.js";

export const allowedStatusTransitions = [
  "IDENTIFIED -> IN_DESIGN",
  "IN_DESIGN -> PROMOTED",
  "any -> REJECTED"
];

export function canTransition(
  from: StoredGoal["status"],
  to: StoredGoal["status"]
): boolean {
  return (
    from === to ||
    to === "REJECTED" ||
    (from === "IDENTIFIED" && to === "IN_DESIGN") ||
    (from === "IN_DESIGN" && to === "PROMOTED")
  );
}

export function goalWithProjectId(
  state: SignupState,
  goalId: string
): { goal: StoredGoal; projectId: string } | undefined {
  for (const [projectId, goals] of state.goalsByProjectId) {
    const goal = goals.find((candidate) => candidate.id === goalId);
    if (goal !== undefined) {
      return { goal, projectId };
    }
  }

  return undefined;
}

export function activeActorWithId(
  state: SignupState,
  projectId: string,
  actorId: string
): StoredActor | undefined {
  return (state.actorsByProjectId.get(projectId) ?? []).find(
    (actor) => actor.id === actorId && actor.archived_at === null
  );
}

export function projectWorkspaceArchived(state: SignupState, projectId: string): boolean {
  const project = state.projectsById.get(projectId);
  return project !== undefined && state.workspaceArchivedAt.has(project.workspace_id);
}

export function goalRevision(goal: StoredGoal, versionNumber: number) {
  return {
    id: randomUUID(),
    entity_type: "GOAL" as const,
    entity_id: goal.id,
    version_number: versionNumber,
    snapshot: { ...goal }
  };
}

export function nearDuplicateGoal(
  state: SignupState,
  projectId: string,
  actorId: string,
  description: string
): StoredGoal | undefined {
  const normalized = comparableDescription(description);
  return (state.goalsByProjectId.get(projectId) ?? []).find(
    (goal) =>
      goal.actor_id === actorId && comparableDescription(goal.description) === normalized
  );
}

export function goalCreateResponse(
  goal: StoredGoal,
  revision: ReturnType<typeof goalRevision>,
  duplicate: StoredGoal | undefined
) {
  return {
    goal,
    revision,
    recommended_next_command: "vspec goal list",
    ...(duplicate === undefined
      ? {}
      : {
          warnings: [
            {
              type: "NEAR_DUPLICATE_GOAL",
              candidate_goal_id: duplicate.id,
              command: `vspec goal show ${duplicate.id}`
            }
          ]
        })
  };
}

export function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
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

export function goalIdFrom(params: unknown): string {
  return z.object({ goalId: z.string().min(1) }).parse(params).goalId;
}
