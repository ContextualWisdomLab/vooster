import type { StoredGoal } from "../http/signup-types.js";

export type GoalStore = {
  findGoalById: (goalId: string) => Promise<StoredGoal | undefined>;
  listGoals: (projectId: string) => Promise<StoredGoal[]>;
  saveGoal: (goal: StoredGoal) => Promise<void>;
  updateGoal: (goal: StoredGoal) => Promise<void>;
};
