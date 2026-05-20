import { randomUUID } from "node:crypto";
import type {
  StoredLock,
  StoredRevision,
  StoredStep,
  StoredUseCase
} from "../http/signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type StepEditingDeps = {
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  scenarioStore: ScenarioStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type StepEditingInput = {
  action: string | undefined;
  baseRevision: string;
  force: boolean;
  notes: string | undefined;
  stepId: string;
  userId: string | undefined;
};

export type StepEditingResult =
  | { status: "STEP_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | {
      baseRevision: string;
      currentRevision: string;
      status: "STALE_BASE";
      usecase: StoredUseCase;
    }
  | { status: "EMPTY_ACTION" }
  | { action: string; status: "PASSIVE_ACTION" }
  | { lock: StoredLock; status: "HARD_LOCKED" }
  | { lock: StoredLock; status: "SEMANTIC_LOCKED" }
  | {
      affectedSessions: string[];
      revision: StoredRevision;
      status: "UPDATED";
      step: StoredStep;
    };

export async function editStep(
  deps: StepEditingDeps,
  input: StepEditingInput
): Promise<StepEditingResult> {
  const found = await stepWithUseCase(deps, input.stepId);
  if (found === undefined) {
    return { status: "STEP_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }

  const currentRevision = await currentRevisionId(deps.revisionStore, found.usecase);
  if (input.baseRevision !== currentRevision) {
    return {
      baseRevision: input.baseRevision,
      currentRevision,
      status: "STALE_BASE",
      usecase: found.usecase
    };
  }
  if (input.action !== undefined && input.action.trim().length === 0) {
    return { status: "EMPTY_ACTION" };
  }
  if (input.action !== undefined && !input.force && usesPassiveVoice(input.action)) {
    return { action: input.action, status: "PASSIVE_ACTION" };
  }

  const lock = await deps.lockStore.findLockForUseCase(found.usecase.id);
  if (lock?.mode === "HARD") {
    return { lock, status: "HARD_LOCKED" };
  }
  if (lock?.mode === "SEMANTIC" && input.action !== undefined) {
    return { lock, status: "SEMANTIC_LOCKED" };
  }

  const updated = {
    ...found.step,
    action: input.action ?? found.step.action,
    notes: input.notes ?? found.step.notes
  };
  await deps.stepStore.updateStep(updated);
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Edited step ${updated.id}`,
    input.action === undefined && input.notes !== undefined ? "COSMETIC" : "BREAKING"
  );
  return {
    affectedSessions: await affectedSessionIds(deps.workSessionStore, found.usecase.id),
    revision,
    status: "UPDATED",
    step: updated
  };
}

async function stepWithUseCase(
  deps: Pick<StepEditingDeps, "scenarioStore" | "stepStore" | "useCaseStore">,
  stepId: string
): Promise<
  | {
      projectId: string;
      step: StoredStep;
      usecase: StoredUseCase;
    }
  | undefined
> {
  const step = await deps.stepStore.findStepById(stepId);
  if (step === undefined) {
    return undefined;
  }
  const scenario = await deps.scenarioStore.findScenarioById(step.scenario_id);
  if (scenario === undefined) {
    return undefined;
  }
  const found = await deps.useCaseStore.findUseCaseWithProject(scenario.usecase_id);
  return found === undefined
    ? undefined
    : { projectId: found.projectId, step, usecase: found.usecase };
}

async function currentRevisionId(revisionStore: RevisionStore, usecase: StoredUseCase) {
  return (
    (await revisionStore.latestRevision(usecase.id))?.id ?? usecase.current_revision_id
  );
}

async function appendUseCaseRevision(
  deps: Pick<StepEditingDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase,
  changeSummary: string,
  severity: "BREAKING" | "COSMETIC"
) {
  const revision = {
    change_summary: changeSummary,
    entity_id: usecase.id,
    entity_type: "USECASE" as const,
    id: idFrom(deps),
    severity,
    snapshot: { ...usecase },
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id)
  };
  await deps.revisionStore.saveRevision(revision);
  return revision;
}

async function affectedSessionIds(
  workSessionStore: WorkSessionStore,
  usecaseId: string
): Promise<string[]> {
  return (await workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .filter((session) => session.status === "ACTIVE")
    .map((session) => session.id);
}

export function usesPassiveVoice(action: string): boolean {
  return /^.+?\s+is\s+\w+ed\.?$/i.test(action.trim());
}

export function activeRewrite(action: string): string {
  const match = /^(?<object>.+?)\s+is\s+(?<verb>\w+)\.?$/i.exec(action.trim());
  if (match?.groups?.object === undefined || match.groups.verb === undefined) {
    return "Rewrite the step in active voice.";
  }

  return `${capitalized(match.groups.verb)} the ${match.groups.object.toLowerCase()}.`;
}

function capitalized(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function idFrom(deps: Pick<StepEditingDeps, "idFactory">) {
  return (deps.idFactory ?? randomUUID)();
}
