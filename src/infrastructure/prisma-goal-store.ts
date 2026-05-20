import type { PrismaClient } from "@prisma/client";

import type { StoredGoal } from "../domain/entities/index.js";
import type { GoalStore } from "../ports/goal-store.js";
import {
  goalData,
  goalUpdate,
  storedGoal
} from "./prisma-signup-mappers.js";

export function createPrismaGoalStore(prisma: PrismaClient): GoalStore {
  return new PrismaGoalStore(prisma);
}

class PrismaGoalStore implements GoalStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findGoalById(goalId: string): Promise<StoredGoal | undefined> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId }
    });

    return goal === null ? undefined : storedGoal(goal);
  }

  async listGoals(projectId: string): Promise<StoredGoal[]> {
    const goals = await this.prisma.goal.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return goals.map(storedGoal);
  }

  async saveGoal(goal: StoredGoal): Promise<void> {
    await this.prisma.goal.create({ data: goalData(goal) });
  }

  async updateGoal(goal: StoredGoal): Promise<void> {
    await this.prisma.goal.update({
      data: goalUpdate(goal),
      where: { id: goal.id }
    });
  }
}
