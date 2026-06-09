import { randomUUID } from "node:crypto";
import { usesPassiveVoice } from "./passive-voice.js";
import type {
  StoredActor,
  StoredLock,
  StoredRevision,
  StoredStep,
  StoredUseCase
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type StepEditingDeps = {
  actorStore: ActorStore;
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
  actorName: string | undefined;
  baseRevision: string;
  force: boolean;
  implementationRefs?: string[];
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
  | { status: "NO_CHANGES" }
  | { knownActors: string[]; status: "UNKNOWN_ACTOR" }
  | { action: string; status: "PASSIVE_ACTION" }
  | { lock: StoredLock; usecase: StoredUseCase; status: "HARD_LOCKED" }
  | { lock: StoredLock; usecase: StoredUseCase; status: "SEMANTIC_LOCKED" }
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
  if (!hasRequestedChange(input)) {
    return { status: "NO_CHANGES" };
  }
  if (input.action !== undefined && !input.force && usesPassiveVoice(input.action)) {
    return { action: input.action, status: "PASSIVE_ACTION" };
  }

  const actor = await actorForEdit(deps.actorStore, found.projectId, input.actorName);
  if (actor.status === "UNKNOWN_ACTOR") {
    return actor;
  }

  const lock = await deps.lockStore.findLockForUseCase(found.usecase.id);
  if (lock?.mode === "HARD") {
    return { lock, usecase: found.usecase, status: "HARD_LOCKED" };
  }
  if (
    lock?.mode === "SEMANTIC" &&
    (input.action !== undefined || actor.actor !== undefined)
  ) {
    return { lock, usecase: found.usecase, status: "SEMANTIC_LOCKED" };
  }

  const updated = {
    ...found.step,
    action: input.action ?? found.step.action,
    actor_id: actor.actor?.id ?? found.step.actor_id,
    implements: input.implementationRefs ?? found.step.implements,
    notes: input.notes ?? found.step.notes
  };
  await deps.stepStore.updateStep(updated);
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Edited step ${updated.id}`,
    cosmeticEdit(input, actor.actor) ? "COSMETIC" : "BREAKING"
  );
  return {
    affectedSessions: await affectedSessionIds(deps.workSessionStore, found.usecase.id),
    revision,
    status: "UPDATED",
    step: updated
  };
}

function hasRequestedChange(input: StepEditingInput): boolean {
  return (
    input.action !== undefined ||
    input.actorName !== undefined ||
    input.implementationRefs !== undefined ||
    input.notes !== undefined
  );
}

async function actorForEdit(
  actorStore: ActorStore,
  projectId: string,
  actorName: string | undefined
): Promise<
  | { actor: StoredActor | undefined; status: "OK" }
  | { knownActors: string[]; status: "UNKNOWN_ACTOR" }
> {
  if (actorName === undefined) {
    return { actor: undefined, status: "OK" };
  }
  const actor = await actorStore.findActorByName(projectId, actorName);
  if (actor !== undefined && actor.archived_at === null) {
    return { actor, status: "OK" };
  }
  return {
    knownActors: (await actorStore.listActors(projectId))
      .filter((candidate) => candidate.archived_at === null)
      .map((candidate) => candidate.name),
    status: "UNKNOWN_ACTOR"
  };
}

function cosmeticEdit(input: StepEditingInput, actor: StoredActor | undefined) {
  return (
    input.action === undefined &&
    actor === undefined &&
    input.implementationRefs === undefined &&
    input.notes !== undefined
  );
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
  deps: Pick<StepEditingDeps, "idFactory" | "revisionStore" | "useCaseStore">,
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
  revision.snapshot = { ...usecase, current_revision_id: revision.id };
  await deps.revisionStore.saveRevision(revision);
  await deps.useCaseStore.updateUseCase({
    ...usecase,
    current_revision_id: revision.id
  });
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
