import type { StoredGoal } from "../http/signup-types.js";
import type { GoalStore } from "../ports/goal-store.js";

export function createMemoryGoalStore(): GoalStore {
  const goalsById = new Map<string, StoredGoal>();

  return {
    findGoalById(goalId) {
      return Promise.resolve(goalsById.get(goalId));
    },

    listGoals(projectId) {
      return Promise.resolve(
        [...goalsById.values()].filter((goal) => goal.project_id === projectId)
      );
    },

    saveGoal(goal) {
      goalsById.set(goal.id, goal);
      return Promise.resolve();
    },

    updateGoal(goal) {
      goalsById.set(goal.id, goal);
      return Promise.resolve();
    }
  };
}
