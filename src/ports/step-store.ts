import type { StoredStep } from "../http/signup-types.js";

export type StepStore = {
  findStepById: (stepId: string) => Promise<StoredStep | undefined>;
  listSteps: (scenarioId: string) => Promise<StoredStep[]>;
  saveStep: (step: StoredStep) => Promise<void>;
  updateStep: (step: StoredStep) => Promise<void>;
};
