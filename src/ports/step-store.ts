import type { StoredStep } from "../domain/entities/index.js";

export type StepStore = {
  findStepById: (stepId: string) => Promise<StoredStep | undefined>;
  listSteps: (scenarioId: string) => Promise<StoredStep[]>;
  saveStep: (step: StoredStep) => Promise<void>;
  updateStep: (step: StoredStep) => Promise<void>;
};
