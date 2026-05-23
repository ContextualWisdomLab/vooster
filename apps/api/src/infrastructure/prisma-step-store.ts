import type { PrismaClient } from "@prisma/client";

import type { StoredStep } from "../domain/entities/index.js";
import type { StepStore } from "../ports/step-store.js";
import { stepData, stepUpdate, storedStep } from "./prisma-signup-mappers.js";

export function createPrismaStepStore(prisma: PrismaClient): StepStore {
  return new PrismaStepStore(prisma);
}

class PrismaStepStore implements StepStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findStepById(stepId: string): Promise<StoredStep | undefined> {
    const step = await this.prisma.step.findUnique({
      where: { id: stepId }
    });

    return step === null ? undefined : storedStep(step);
  }

  async listSteps(scenarioId: string): Promise<StoredStep[]> {
    const steps = await this.prisma.step.findMany({
      orderBy: [{ order_index: "asc" }, { step_number: "asc" }],
      where: { scenario_id: scenarioId }
    });

    return steps.map(storedStep);
  }

  async saveStep(step: StoredStep): Promise<void> {
    await this.prisma.step.create({
      data: stepData(step)
    });
  }

  async updateStep(step: StoredStep): Promise<void> {
    await this.prisma.step.update({
      data: stepUpdate(step),
      where: { id: step.id }
    });
  }
}
