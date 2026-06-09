import type { StoredStep } from "../domain/entities/index.js";

export function orderScenarioStepsForDisplay(steps: StoredStep[]): StoredStep[] {
  return [...steps].sort(
    (left, right) =>
      left.step_number - right.step_number ||
      left.order_index - right.order_index ||
      left.id.localeCompare(right.id)
  );
}
