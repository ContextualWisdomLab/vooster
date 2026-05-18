type MergeResolution = {
  entity_id: string;
  field?: string;
  strategy: string;
  value?: unknown;
};

export function manualResolutionMissingValue(resolutions: MergeResolution[]) {
  return resolutions.find(
    (resolution) => resolution.strategy === "MANUAL" && resolution.value === undefined
  );
}

export function uncoveredConflicts(
  conflicts: Array<Record<string, unknown>>,
  resolutions: MergeResolution[]
) {
  return conflicts.filter((conflict) =>
    !resolutions.some((resolution) => resolution.entity_id === String(conflict.entity_id))
  );
}
