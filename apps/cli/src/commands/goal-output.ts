import type {
  GoalListResponse,
  GoalPromotionResponse,
  GoalResponse
} from "@vooster/contracts";

export function printGoalResponse(
  body: GoalResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Goal ${body.goal.description}`);
  writeLine(`Goal id ${body.goal.id}`);
  writeLine(`Status ${body.goal.status} ${body.goal.priority}`);
  if (body.revision !== undefined) {
    writeLine(`Revision version ${String(body.revision.version_number)}`);
  }
  for (const warning of body.warnings ?? []) {
    if (warning.command !== undefined) {
      writeLine(`Warning ${warning.command}`);
    }
  }
  if (body.recommended_next_command !== undefined) {
    writeLine(body.recommended_next_command);
  }
}

export function printGoalList(
  body: GoalListResponse,
  writeLine: (message: string) => void
): void {
  for (const actorGoals of body.actors) {
    writeLine(`Actor ${actorGoals.actor.name}`);
    for (const goal of actorGoals.goals) {
      writeLine(`${goal.description} ${goal.priority} ${goal.status}`);
    }
  }
}

export function printGoalPromotion(
  body: GoalPromotionResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Title ${body.usecase.title}`);
  writeLine(`Format ${body.usecase.format}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(`Goal ${body.goal.status}`);
  for (const warning of body.warnings ?? []) {
    if (warning.message !== undefined) {
      writeLine(`Warning ${warning.message}`);
    }
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}
