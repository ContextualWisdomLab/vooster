import type {
  StoredScenario,
  StoredStep,
  StoredUseCase
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { StepStore } from "../ports/step-store.js";
import { implementsAnnotation, invocationAnnotation } from "./markdown-invocations.js";
import { orderScenarioStepsForDisplay } from "./scenario-step-ordering.js";

export type MarkdownRenderDeps = {
  actorStore: ActorStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stakeholderStore: StakeholderStore;
  stepStore: StepStore;
};

export async function renderMarkdown(
  deps: MarkdownRenderDeps,
  projectId: string,
  usecase: StoredUseCase
) {
  return [
    await frontmatter(deps.actorStore, projectId, usecase),
    `# ${usecase.title}`,
    await stakeholderSection(deps, projectId, usecase.id),
    "## Preconditions\n\n- None recorded.",
    "## Trigger\n\nNot recorded.",
    await mainScenarioSection(deps, projectId, usecase.id),
    await extensionSection(deps, projectId, usecase.id),
    "## Success Guarantee\n\nNot recorded.",
    "## Minimal Guarantee\n\nNot recorded.",
    "## Notes\n"
  ].join("\n\n");
}

export async function hasMainSteps(
  scenarioStore: ScenarioStore,
  stepStore: StepStore,
  usecase: StoredUseCase
) {
  const main = await scenarioStore.findMainScenario(usecase.id);
  return (await scenarioSteps(stepStore, main?.id)).length > 0;
}

async function frontmatter(
  actorStore: ActorStore,
  projectId: string,
  usecase: StoredUseCase
) {
  return `---\nvspec_format: 1\ntype: usecase\nid: ${usecase.id}\nkey: ${usecase.key}\ntitle: ${usecase.title}\nlevel: ${usecase.level}\nformat: ${usecase.format}\nstatus: ${usecase.status}\npriority: ${usecase.priority}\nscope: ${usecase.scope}\nprimary_actor: ${await actorName(actorStore, projectId, usecase.primary_actor_id)}\nrevision: ${usecase.current_revision_id}\n---`;
}

async function stakeholderSection(
  deps: MarkdownRenderDeps,
  projectId: string,
  usecaseId: string
) {
  const lines = await Promise.all(
    (await deps.stakeholderInterestStore.listStakeholderInterests(usecaseId)).map(
      async (interest) => {
        const stakeholder = await deps.stakeholderStore.findStakeholderById(
          projectId,
          interest.stakeholder_id
        );
        return `- **${stakeholder?.name ?? "Stakeholder"}**: ${interest.interest}`;
      }
    )
  );
  return [
    "## Stakeholders and Interests",
    ...(lines.length === 0 ? ["- None recorded."] : lines)
  ].join("\n\n");
}

async function mainScenarioSection(
  deps: MarkdownRenderDeps,
  projectId: string,
  usecaseId: string
) {
  const scenario = await deps.scenarioStore.findMainScenario(usecaseId);
  const lines = await Promise.all(
    (await scenarioSteps(deps.stepStore, scenario?.id)).map((step, index) =>
      stepLine(deps.actorStore, projectId, step, `${String(index + 1)}.`)
    )
  );
  return [
    "## Main Success Scenario",
    ...(lines.length === 0 ? ["1. **System** Not recorded."] : lines)
  ].join("\n\n");
}

async function extensionSection(
  deps: MarkdownRenderDeps,
  projectId: string,
  usecaseId: string
) {
  const rendered = await Promise.all(
    (await deps.scenarioStore.listScenarios(usecaseId))
      .filter((scenario) => scenario.type === "EXTENSION")
      .sort(compareExtensions)
      .map((scenario) => renderExtension(deps, projectId, scenario))
  );
  return [
    "## Extensions",
    ...(rendered.length === 0 ? ["None recorded."] : rendered)
  ].join("\n\n");
}

function compareExtensions(left: StoredScenario, right: StoredScenario) {
  const leftKey = extensionSortKey(left.extension_point ?? "*z");
  const rightKey = extensionSortKey(right.extension_point ?? "*z");
  return (
    leftKey.parent - rightKey.parent || leftKey.suffix.localeCompare(rightKey.suffix)
  );
}

function extensionSortKey(point: string) {
  const anyStep = point.startsWith("*");
  return {
    parent: anyStep ? Number.MAX_SAFE_INTEGER : Number.parseInt(point, 10),
    suffix: point.at(-1) ?? ""
  };
}

async function renderExtension(
  deps: MarkdownRenderDeps,
  projectId: string,
  scenario: StoredScenario
) {
  const point = scenario.extension_point ?? "*a";
  const steps = await Promise.all(
    (await scenarioSteps(deps.stepStore, scenario.id)).map((step, index) =>
      stepLine(deps.actorStore, projectId, step, `- ${point}${String(index + 1)}.`)
    )
  );
  return [
    `### ${point}. ${scenario.condition ?? "Extension"}`,
    ...steps,
    `- (Outcome: ${scenario.outcome} - use case ends.)`
  ].join("\n\n");
}

async function scenarioSteps(
  stepStore: StepStore,
  scenarioId: string | undefined
): Promise<StoredStep[]> {
  return orderScenarioStepsForDisplay(await stepStore.listSteps(scenarioId ?? ""));
}

async function stepLine(
  actorStore: ActorStore,
  projectId: string,
  step: StoredStep,
  label: string
) {
  return `${label} **${await actorName(actorStore, projectId, step.actor_id)}** ${step.action}${invocationAnnotation(step.invokes)}${implementsAnnotation(step.implements)}`;
}

async function actorName(actorStore: ActorStore, projectId: string, actorId: string) {
  return (await actorStore.findActorById(projectId, actorId))?.name ?? "System";
}
