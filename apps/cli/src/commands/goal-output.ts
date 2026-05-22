export type GoalResponse = {
  goal: {
    description: string;
    id?: string;
    priority: string;
    status: string;
  };
  recommended_next_command?: string;
  revision?: {
    version_number: number;
  };
  warnings?: Array<{
    command: string;
  }>;
};

export type GoalListResponse = {
  actors: Array<{
    actor: {
      name: string;
    };
    goals: Array<{
      description: string;
      priority: string;
      status: string;
    }>;
  }>;
};

export type GoalPromotionResponse = {
  goal: {
    status: string;
  };
  revision: {
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    format: string;
    key: string;
    title: string;
  };
  warnings?: Array<{
    message: string;
  }>;
};

export function printGoalResponse(
  body: GoalResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Goal ${body.goal.description}`);
  if (body.goal.id !== undefined) {
    writeLine(`Goal id ${body.goal.id}`);
  }
  writeLine(`Status ${body.goal.status} ${body.goal.priority}`);
  if (body.revision !== undefined) {
    writeLine(`Revision version ${String(body.revision.version_number)}`);
  }
  for (const warning of body.warnings ?? []) {
    writeLine(`Warning ${warning.command}`);
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
    writeLine(`Warning ${warning.message}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}
