import { randomUUID } from "node:crypto";
import { goalParamsSchema, goalProjectParamsSchema } from "@vooster/contracts";
import type { StoredGoal } from "../domain/entities/index.js";

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

export function projectIdFrom(params: unknown): string {
  return goalProjectParamsSchema.parse(params).projectId;
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
  return goalParamsSchema.parse(params).goalId;
}
