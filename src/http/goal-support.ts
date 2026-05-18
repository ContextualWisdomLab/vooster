import { z } from "zod";
import type { SignupState, StoredGoal } from "./signup-types.js";

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

export function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}

export function goalIdFrom(params: unknown): string {
  return z.object({ goalId: z.string().min(1) }).parse(params).goalId;
}
