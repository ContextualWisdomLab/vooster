import { randomUUID } from "node:crypto";
import type {
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../http/signup-types.js";
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

export type CreateScenarioInput =
  | { type: "MAIN_SUCCESS"; usecaseId: string; userId?: string }
  | {
      condition?: string;
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
  | { existingCondition: string | null; status: "DUPLICATE_EXTENSION_POINT"; suggestedExtensionPoint: string }
  | { parentStepNumber: number | null; status: "EXTENSION_PARENT_OUT_OF_RANGE"; usecaseKey: string }
  | { status: "FORBIDDEN" | "INVALID_EXTENSION_POINT" | "INVALID_EXTENSION_REQUEST" | "MISSING_STAKEHOLDER_INTEREST" | "USECASE_NOT_FOUND" };

export type AddScenarioStepInput = {
  action: string;
  actorName: string;
  force: boolean;
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
  | { status: "FORBIDDEN" | "PASSIVE_ACTION" | "SCENARIO_NOT_FOUND"; suggestedAction?: string };

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
    : createMainSuccessScenario(deps, found);
}

export async function addScenarioStep(
  deps: ScenarioAuthoringDeps,
  input: AddScenarioStepInput
): Promise<AddScenarioStepResult> {
  const found = await scenarioWithUseCase(deps, input.scenarioId);
  if (found === undefined) {
    return { status: "SCENARIO_NOT_FOUND" };
  }
  if (!await hasMembership(deps.membershipStore, found.projectId, input.userId)) {
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
  const step = {
    action: input.action,
    actor_id: actor.id,
    id: idFrom(deps),
    is_system_step: actor.name === "System",
    notes: null,
    order_index: steps.length,
    scenario_id: found.scenario.id,
    step_number: steps.length + 1
  };
  const scenarioSteps = [...steps, step];
  await deps.stepStore.saveStep(step);
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Added step ${String(step.step_number)} to main success scenario`
  );

  return {
    overNineSteps: scenarioSteps.length > 9,
    revision,
    scenarioSteps,
    status: "STEP_ADDED",
    step
  };
}

async function createMainSuccessScenario(
  deps: ScenarioAuthoringDeps,
  found: { projectId: string; status: "AUTHORIZED"; usecase: StoredUseCase }
): Promise<CreateScenarioResult> {
  const existing = await deps.scenarioStore.findMainScenario(found.usecase.id);
  if (existing !== undefined) {
    return { existingScenario: existing, status: "DUPLICATE_MAIN_SUCCESS" };
  }
  if ((await deps.stakeholderInterestStore.listStakeholderInterests(found.usecase.id)).length === 0) {
    return { status: "MISSING_STAKEHOLDER_INTEREST" };
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
  await deps.scenarioStore.saveScenario(scenario);
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Created main success scenario ${scenario.id}`
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
  const existing = await extensionAtPoint(deps.scenarioStore, found.usecase.id, input.extensionPoint);
  if (existing !== undefined) {
    return {
      existingCondition: existing.condition,
      status: "DUPLICATE_EXTENSION_POINT",
      suggestedExtensionPoint: await nextExtensionPoint(deps.scenarioStore, found.usecase.id, input.extensionPoint)
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
  await deps.scenarioStore.saveScenario(scenario);
  const revision = await appendUseCaseRevision(
    deps,
    found.usecase,
    `Created extension scenario ${scenario.id}`
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
  return await hasMembership(deps.membershipStore, found.projectId, userId)
    ? { projectId: found.projectId, status: "AUTHORIZED", usecase: found.usecase }
    : { status: "FORBIDDEN" };
}

async function scenarioWithUseCase(
  deps: Pick<ScenarioAuthoringDeps, "scenarioStore" | "useCaseStore">,
  scenarioId: string
): Promise<{ projectId: string; scenario: StoredScenario; usecase: StoredUseCase } | undefined> {
  const scenario = await deps.scenarioStore.findScenarioById(scenarioId);
  if (scenario === undefined) {
    return undefined;
  }
  const found = await deps.useCaseStore.findUseCaseWithProject(scenario.usecase_id);
  return found === undefined
    ? undefined
    : { projectId: found.projectId, scenario, usecase: found.usecase };
}

async function appendUseCaseRevision(
  deps: Pick<ScenarioAuthoringDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase,
  changeSummary: string
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
  await deps.revisionStore.saveRevision(revision);
  return revision;
}

async function hasMembership(
  membershipStore: MembershipStore,
  projectId: string,
  userId: string | undefined
): Promise<boolean> {
  return (
    userId !== undefined &&
    await membershipStore.membershipForProject(projectId, userId) !== undefined
  );
}

function extensionPointParentStep(extensionPoint: string): number | null {
  const match = /^(?<step>\d+)[a-z]$/.exec(extensionPoint);
  return match?.groups?.step === undefined ? null : Number.parseInt(match.groups.step, 10);
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
  while (await extensionAtPoint(scenarioStore, usecaseId, candidate) !== undefined) {
    letterCode += 1;
    candidate = `${prefix}${String.fromCharCode(letterCode)}`;
  }
  return candidate;
}

export function usesPassiveVoice(action: string): boolean {
  return /^.+?\s+is\s+\w+ed\.?$/i.test(action.trim());
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
