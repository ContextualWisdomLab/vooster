import { randomUUID } from "node:crypto";
import { usesPassiveVoice } from "./passive-voice.js";
import type {
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type ScenarioAuthoringDeps = {
  actorStore: ActorStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
};

type ScenarioStepPositioningDeps = Pick<
  ScenarioAuthoringDeps,
  | "idFactory"
  | "membershipStore"
  | "revisionStore"
  | "scenarioStore"
  | "stepStore"
  | "useCaseStore"
>;

export type CreateScenarioInput =
  | { dryRun?: boolean; type: "MAIN_SUCCESS"; usecaseId: string; userId?: string }
  | {
      condition?: string;
      dryRun?: boolean;
      extensionPoint?: string;
      outcome?: "FAILURE" | "PARTIAL" | "SUCCESS";
      type: "EXTENSION";
      usecaseId: string;
      userId?: string;
    };

export type CreateScenarioResult =
  | {
      defaultOutcome?: boolean;
      revision: StoredRevision;
      scenario: StoredScenario;
      status: "CREATED";
      steps: StoredStep[];
    }
  | { existingScenario: StoredScenario; status: "DUPLICATE_MAIN_SUCCESS" }
  | {
      existingCondition: string | null;
      status: "DUPLICATE_EXTENSION_POINT";
      suggestedExtensionPoint: string;
    }
  | {
      parentStepNumber: number | null;
      status: "EXTENSION_PARENT_OUT_OF_RANGE";
      usecaseKey: string;
    }
  | { status: "MISSING_STAKEHOLDER_INTEREST"; usecaseKey: string }
  | {
      status:
        | "FORBIDDEN"
        | "INVALID_EXTENSION_POINT"
        | "INVALID_EXTENSION_REQUEST"
        | "USECASE_NOT_FOUND";
    };

export type AddScenarioStepInput = {
  action: string;
  actorName: string;
  dryRun?: boolean;
  force: boolean;
  position?: number;
  scenarioId: string;
  userId?: string;
};

export type AddScenarioStepResult =
  | {
      overNineSteps: boolean;
      revision: StoredRevision;
      scenarioSteps: StoredStep[];
      status: "STEP_ADDED";
      step: StoredStep;
    }
  | { knownActors: string[]; status: "UNKNOWN_STEP_ACTOR" }
  | {
      status: "FORBIDDEN" | "PASSIVE_ACTION" | "SCENARIO_NOT_FOUND";
      suggestedAction?: string;
    };

export type MoveScenarioStepInput = {
  dryRun?: boolean;
  stepId: string;
  toPosition: number;
  userId?: string;
};

export type MoveScenarioStepResult =
  | {
      revision: StoredRevision;
      scenarioSteps: StoredStep[];
      status: "STEP_MOVED";
      step: StoredStep;
    }
  | { status: "FORBIDDEN" | "STEP_NOT_FOUND" };

export async function createScenario(
  deps: ScenarioAuthoringDeps,
  input: CreateScenarioInput
): Promise<CreateScenarioResult> {
  const found = await authorizedUseCase(deps, input.usecaseId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  return input.type === "EXTENSION"
    ? createExtensionScenario(deps, found, input)
    : createMainSuccessScenario(deps, found, input.dryRun === true);
}

export async function addScenarioStep(
  deps: ScenarioAuthoringDeps,
  input: AddScenarioStepInput
): Promise<AddScenarioStepResult> {
  const found = await scenarioWithUseCase(deps, input.scenarioId);
  if (found === undefined) {
    return { status: "SCENARIO_NOT_FOUND" };
  }
  if (!(await hasMembership(deps.membershipStore, found.projectId, input.userId))) {
    return { status: "FORBIDDEN" };
  }
  if (!input.force && usesPassiveVoice(input.action)) {
    return { status: "PASSIVE_ACTION", suggestedAction: activeRewrite(input.action) };
  }

  const actor = await deps.actorStore.findActorByName(found.projectId, input.actorName);
  if (actor === undefined || actor.archived_at !== null) {
    return {
      knownActors: (await deps.actorStore.listActors(found.projectId))
        .filter((candidate) => candidate.archived_at === null)
        .map((candidate) => candidate.name),
      status: "UNKNOWN_STEP_ACTOR"
    };
  }

  const steps = await deps.stepStore.listSteps(found.scenario.id);
  const candidateStep = {
    action: input.action,
    actor_id: actor.id,
    id: idFrom(deps),
    implements: [],
    invokes: [],
    is_system_step: actor.name === "System",
    notes: null,
    order_index: 0,
    scenario_id: found.scenario.id,
    step_number: 0
  };
  const scenarioSteps = insertScenarioStep(steps, candidateStep, input.position);
  const step = stepById(scenarioSteps, candidateStep.id);
  const dryRun = input.dryRun === true;
  if (!dryRun) {
    await deps.stepStore.saveStep(step);
    await persistStepPositionUpdates(deps.stepStore, steps, scenarioSteps);
  }
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Added step ${String(step.step_number)} to main success scenario`,
    dryRun
  );

  return {
    overNineSteps: scenarioSteps.length > 9,
    revision,
    scenarioSteps,
    status: "STEP_ADDED",
    step
  };
}

export async function moveScenarioStep(
  deps: ScenarioStepPositioningDeps,
  input: MoveScenarioStepInput
): Promise<MoveScenarioStepResult> {
  const found = await stepWithUseCase(deps, input.stepId);
  if (found === undefined) {
    return { status: "STEP_NOT_FOUND" };
  }
  if (!(await hasMembership(deps.membershipStore, found.projectId, input.userId))) {
    return { status: "FORBIDDEN" };
  }

  const steps = await deps.stepStore.listSteps(found.step.scenario_id);
  const scenarioSteps = moveStepToPosition(steps, input.stepId, input.toPosition);
  const step = stepById(scenarioSteps, input.stepId);
  const dryRun = input.dryRun === true;
  if (!dryRun) {
    await persistStepPositionUpdates(deps.stepStore, steps, scenarioSteps);
  }
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Moved step ${step.id} to position ${String(step.step_number)}`,
    dryRun
  );

  return { revision, scenarioSteps, status: "STEP_MOVED", step };
}

export function resequenceScenarioSteps(steps: StoredStep[]): StoredStep[] {
  return steps.map((step, index) => ({
    ...step,
    order_index: index,
    step_number: index + 1
  }));
}

async function createMainSuccessScenario(
  deps: ScenarioAuthoringDeps,
  found: { projectId: string; status: "AUTHORIZED"; usecase: StoredUseCase },
  dryRun: boolean
): Promise<CreateScenarioResult> {
  const existing = await deps.scenarioStore.findMainScenario(found.usecase.id);
  if (existing !== undefined) {
    return { existingScenario: existing, status: "DUPLICATE_MAIN_SUCCESS" };
  }
  if (
    (await deps.stakeholderInterestStore.listStakeholderInterests(found.usecase.id))
      .length === 0
  ) {
    return {
      status: "MISSING_STAKEHOLDER_INTEREST",
      usecaseKey: found.usecase.key
    };
  }

  const scenario = {
    condition: null,
    extension_point: null,
    id: idFrom(deps),
    order_index: 0,
    outcome: "SUCCESS" as const,
    parent_step_number: null,
    type: "MAIN_SUCCESS" as const,
    usecase_id: found.usecase.id
  };
  if (!dryRun) {
    await deps.scenarioStore.saveScenario(scenario);
  }
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Created main success scenario ${scenario.id}`,
    dryRun
  );
  return { revision, scenario, status: "CREATED", steps: [] };
}

async function createExtensionScenario(
  deps: ScenarioAuthoringDeps,
  found: { projectId: string; status: "AUTHORIZED"; usecase: StoredUseCase },
  input: Extract<CreateScenarioInput, { type: "EXTENSION" }>
): Promise<CreateScenarioResult> {
  if (input.extensionPoint === undefined || input.condition === undefined) {
    return { status: "INVALID_EXTENSION_REQUEST" };
  }
  if (!validExtensionPoint(input.extensionPoint)) {
    return { status: "INVALID_EXTENSION_POINT" };
  }
  const parentStepNumber = extensionPointParentStep(input.extensionPoint);
  const mainScenario = await deps.scenarioStore.findMainScenario(found.usecase.id);
  if (
    mainScenario === undefined ||
    (parentStepNumber !== null &&
      !(await mainScenarioHasStep(deps.stepStore, mainScenario, parentStepNumber)))
  ) {
    return {
      parentStepNumber,
      status: "EXTENSION_PARENT_OUT_OF_RANGE",
      usecaseKey: found.usecase.key
    };
  }
  const existing = await extensionAtPoint(
    deps.scenarioStore,
    found.usecase.id,
    input.extensionPoint
  );
  if (existing !== undefined) {
    return {
      existingCondition: existing.condition,
      status: "DUPLICATE_EXTENSION_POINT",
      suggestedExtensionPoint: await nextExtensionPoint(
        deps.scenarioStore,
        found.usecase.id,
        input.extensionPoint
      )
    };
  }

  const scenario = {
    condition: input.condition,
    extension_point: input.extensionPoint,
    id: idFrom(deps),
    order_index: (await deps.scenarioStore.listScenarios(found.usecase.id)).length,
    outcome: input.outcome ?? "FAILURE",
    parent_step_number: parentStepNumber,
    type: "EXTENSION" as const,
    usecase_id: found.usecase.id
  };
  const dryRun = input.dryRun === true;
  if (!dryRun) {
    await deps.scenarioStore.saveScenario(scenario);
  }
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Created extension scenario ${scenario.id}`,
    dryRun
  );
  return {
    defaultOutcome: input.outcome === undefined,
    revision,
    scenario,
    status: "CREATED",
    steps: []
  };
}

async function authorizedUseCase(
  deps: Pick<ScenarioAuthoringDeps, "membershipStore" | "useCaseStore">,
  usecaseId: string,
  userId: string | undefined
): Promise<
  | { projectId: string; status: "AUTHORIZED"; usecase: StoredUseCase }
  | { status: "FORBIDDEN" | "USECASE_NOT_FOUND" }
> {
  const found = await deps.useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  return (await hasMembership(deps.membershipStore, found.projectId, userId))
    ? { projectId: found.projectId, status: "AUTHORIZED", usecase: found.usecase }
    : { status: "FORBIDDEN" };
}

async function scenarioWithUseCase(
  deps: Pick<ScenarioAuthoringDeps, "scenarioStore" | "useCaseStore">,
  scenarioId: string
): Promise<
  { projectId: string; scenario: StoredScenario; usecase: StoredUseCase } | undefined
> {
  const scenario = await deps.scenarioStore.findScenarioById(scenarioId);
  if (scenario === undefined) {
    return undefined;
  }
  const found = await deps.useCaseStore.findUseCaseWithProject(scenario.usecase_id);
  return found === undefined
    ? undefined
    : { projectId: found.projectId, scenario, usecase: found.usecase };
}

async function stepWithUseCase(
  deps: Pick<ScenarioAuthoringDeps, "scenarioStore" | "stepStore" | "useCaseStore">,
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

async function appendUseCaseRevision(
  deps: Pick<ScenarioAuthoringDeps, "idFactory" | "revisionStore" | "useCaseStore">,
  usecase: StoredUseCase,
  changeSummary: string,
  dryRun = false
): Promise<StoredRevision> {
  const revision = {
    change_summary: changeSummary,
    entity_id: usecase.id,
    entity_type: "USECASE" as const,
    id: idFrom(deps),
    severity: "NON_BREAKING" as const,
    snapshot: { ...usecase },
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id)
  };
  revision.snapshot = { ...usecase, current_revision_id: revision.id };
  if (!dryRun) {
    await deps.revisionStore.saveRevision(revision);
    await deps.useCaseStore.updateUseCase({
      ...usecase,
      current_revision_id: revision.id
    });
  }
  return revision;
}

async function hasMembership(
  membershipStore: MembershipStore,
  projectId: string,
  userId: string | undefined
): Promise<boolean> {
  return (
    userId !== undefined &&
    (await membershipStore.membershipForProject(projectId, userId)) !== undefined
  );
}

function insertScenarioStep(
  steps: StoredStep[],
  newStep: StoredStep,
  position: number | undefined
): StoredStep[] {
  const ordered = orderedScenarioSteps(steps);
  const index = clampedPosition(position, ordered.length + 1) - 1;
  return resequenceScenarioSteps([
    ...ordered.slice(0, index),
    newStep,
    ...ordered.slice(index)
  ]);
}

function moveStepToPosition(
  steps: StoredStep[],
  stepId: string,
  position: number
): StoredStep[] {
  const ordered = orderedScenarioSteps(steps);
  const moving = stepById(ordered, stepId);
  const remaining = ordered.filter((step) => step.id !== stepId);
  const index = clampedPosition(position, remaining.length + 1) - 1;
  return resequenceScenarioSteps([
    ...remaining.slice(0, index),
    moving,
    ...remaining.slice(index)
  ]);
}

function orderedScenarioSteps(steps: StoredStep[]): StoredStep[] {
  return [...steps].sort(
    (left, right) =>
      left.order_index - right.order_index || left.step_number - right.step_number
  );
}

function clampedPosition(position: number | undefined, maxPosition: number): number {
  return Math.max(1, Math.min(position ?? maxPosition, maxPosition));
}

function stepById(steps: StoredStep[], stepId: string): StoredStep {
  const step = steps.find((candidate) => candidate.id === stepId);
  if (step === undefined) {
    throw new Error(`Step ${stepId} was not found in its scenario.`);
  }
  return step;
}

async function persistStepPositionUpdates(
  stepStore: StepStore,
  previousSteps: StoredStep[],
  nextSteps: StoredStep[]
): Promise<void> {
  const previousById = new Map(previousSteps.map((step) => [step.id, step]));
  for (const step of nextSteps) {
    const previous = previousById.get(step.id);
    if (previous !== undefined && positionChanged(previous, step)) {
      await stepStore.updateStep(step);
    }
  }
}

function positionChanged(left: StoredStep, right: StoredStep): boolean {
  return (
    left.order_index !== right.order_index || left.step_number !== right.step_number
  );
}

function extensionPointParentStep(extensionPoint: string): number | null {
  const match = /^(?<step>\d+)[a-z]$/.exec(extensionPoint);
  return match?.groups?.step === undefined
    ? null
    : Number.parseInt(match.groups.step, 10);
}

async function mainScenarioHasStep(
  stepStore: StepStore,
  mainScenario: StoredScenario,
  stepNumber: number
): Promise<boolean> {
  return (await stepStore.listSteps(mainScenario.id)).some(
    (step) => step.step_number === stepNumber
  );
}

async function extensionAtPoint(
  scenarioStore: ScenarioStore,
  usecaseId: string,
  extensionPoint: string
): Promise<StoredScenario | undefined> {
  return (await scenarioStore.listScenarios(usecaseId)).find(
    (scenario) => scenario.extension_point === extensionPoint
  );
}

async function nextExtensionPoint(
  scenarioStore: ScenarioStore,
  usecaseId: string,
  extensionPoint: string
): Promise<string> {
  const prefix = extensionPoint.slice(0, -1);
  let letterCode = extensionPoint.charCodeAt(extensionPoint.length - 1) + 1;
  let candidate = `${prefix}${String.fromCharCode(letterCode)}`;
  while ((await extensionAtPoint(scenarioStore, usecaseId, candidate)) !== undefined) {
    letterCode += 1;
    candidate = `${prefix}${String.fromCharCode(letterCode)}`;
  }
  return candidate;
}

function activeRewrite(action: string): string {
  const match = /^(?<object>.+?)\s+is\s+(?<verb>\w+)\.?$/i.exec(action.trim());
  if (match?.groups === undefined) {
    return "Rewrite the step in active voice.";
  }
  const object = match.groups.object;
  const verb = match.groups.verb;
  if (object === undefined || verb === undefined) {
    return "Rewrite the step in active voice.";
  }
  return `${activeVerb(verb)} the ${object.toLowerCase()}.`;
}

function activeVerb(verb: string): string {
  return verb.toLowerCase() === "submitted" ? "Submits" : verb;
}

function validExtensionPoint(extensionPoint: string): boolean {
  return /^(\d+|\*)[a-z]$/.test(extensionPoint);
}

function idFrom(deps: Pick<ScenarioAuthoringDeps, "idFactory">): string {
  return (deps.idFactory ?? randomUUID)();
}
