import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  existingOutputProblem,
  missingMarkdownRevisionProblem,
  outputPathProblem
} from "./markdown-export-problems.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredScenario, StoredStep, StoredUseCase } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const paramsSchema = z.object({ id: z.string().min(1) });
const exportSchema = z.object({
  existing_file_content: z.string().optional(),
  force: z.boolean().default(false),
  output_path: z.string().optional(),
  revision_id: z.string().optional()
});

export function registerMarkdownExportRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore
) {
  app.post("/v1/usecases/:id/export/markdown", (request, reply) =>
    exportMarkdown(
      request,
      reply,
      state,
      actorStore,
      membershipStore,
      useCaseStore,
      scenarioStore
    )
  );
}

async function exportMarkdown(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore,
  scenarioStore: ScenarioStore
) {
  const usecaseId = paramsSchema.parse(request.params).id;
  const parsed = exportSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid markdown export request"));
  }
  const found = await useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to export markdown"));
  }
  if (
    parsed.data.revision_id !== undefined &&
    !hasRevision(state, found.usecase, parsed.data.revision_id)
  ) {
    return reply.code(404).send(missingMarkdownRevisionProblem(found.usecase, parsed.data.revision_id));
  }
  const prerequisiteProblem = await markdownPrerequisiteProblem(
    state,
    scenarioStore,
    found.usecase
  );
  if (prerequisiteProblem !== undefined) {
    return reply.code(422).send(prerequisiteProblem);
  }
  const outputProblem = outputPathProblem(parsed.data.output_path);
  if (outputProblem !== undefined) {
    return reply.code(400).send(outputProblem);
  }
  const markdown = await renderMarkdown(
    state,
    found.projectId,
    found.usecase,
    actorStore,
    scenarioStore
  );
  if (parsed.data.existing_file_content !== undefined && !parsed.data.force) {
    return reply.code(409).send(existingOutputProblem(parsed.data.existing_file_content, markdown));
  }
  return reply
    .header("x-vspec-round-trip-self-check", "passed")
    .type("text/markdown")
    .send(markdown);
}

async function renderMarkdown(
  state: SignupState,
  projectId: string,
  usecase: StoredUseCase,
  actorStore: ActorStore,
  scenarioStore: ScenarioStore
) {
  return [
    await frontmatter(actorStore, projectId, usecase),
    `# ${usecase.title}`,
    stakeholderSection(state, projectId, usecase.id),
    "## Preconditions\n\n- None recorded.",
    "## Trigger\n\nNot recorded.",
    await mainScenarioSection(state, projectId, usecase.id, actorStore, scenarioStore),
    await extensionSection(state, projectId, usecase.id, actorStore, scenarioStore),
    "## Success Guarantee\n\nNot recorded.",
    "## Minimal Guarantee\n\nNot recorded.",
    "## Notes\n"
  ].join("\n\n");
}

async function markdownPrerequisiteProblem(
  state: SignupState,
  scenarioStore: ScenarioStore,
  usecase: StoredUseCase
) {
  const main = await scenarioStore.findMainScenario(usecase.id);
  if (scenarioSteps(state, main?.id).length > 0) {
    return undefined;
  }
  return problem(
    422,
    "Cannot export incomplete use case",
    { missing_required_field: "main_success.steps" },
    [
      {
        command: `vspec doctor ${usecase.key}`,
        reason: "Inspect missing markdown export prerequisites."
      }
    ]
  );
}

function hasRevision(state: SignupState, usecase: StoredUseCase, revisionId: string) {
  return (state.revisionsByEntityId.get(usecase.id) ?? []).some(
    (revision) => revision.id === revisionId
  );
}

async function frontmatter(
  actorStore: ActorStore,
  projectId: string,
  usecase: StoredUseCase
) {
  return `---\nvspec_format: 1\ntype: usecase\nid: ${usecase.id}\nkey: ${usecase.key}\ntitle: ${usecase.title}\nlevel: ${usecase.level}\nformat: ${usecase.format}\nstatus: ${usecase.status}\npriority: ${usecase.priority}\nscope: ${usecase.scope}\nprimary_actor: ${await actorName(actorStore, projectId, usecase.primary_actor_id)}\nrevision: ${usecase.current_revision_id}\n---`;
}

function stakeholderSection(state: SignupState, projectId: string, usecaseId: string) {
  const lines = (state.stakeholderInterestsByUseCaseId.get(usecaseId) ?? [])
    .map((interest) => {
      const stakeholder = (state.stakeholdersByProjectId.get(projectId) ?? [])
        .find((candidate) => candidate.id === interest.stakeholder_id);
      return `- **${stakeholder?.name ?? "Stakeholder"}**: ${interest.interest}`;
    });
  return ["## Stakeholders and Interests", ...(lines.length === 0 ? ["- None recorded."] : lines)]
    .join("\n\n");
}

async function mainScenarioSection(
  state: SignupState,
  projectId: string,
  usecaseId: string,
  actorStore: ActorStore,
  scenarioStore: ScenarioStore
) {
  const scenario = await scenarioStore.findMainScenario(usecaseId);
  const lines = await Promise.all(
    scenarioSteps(state, scenario?.id).map((step, index) =>
      stepLine(actorStore, projectId, step, `${String(index + 1)}.`))
  );
  return ["## Main Success Scenario", ...(lines.length === 0 ? ["1. **System** Not recorded."] : lines)]
    .join("\n\n");
}

async function extensionSection(
  state: SignupState,
  projectId: string,
  usecaseId: string,
  actorStore: ActorStore,
  scenarioStore: ScenarioStore
) {
  const rendered = await Promise.all(
    (await scenarioStore.listScenarios(usecaseId))
      .filter((scenario) => scenario.type === "EXTENSION")
      .sort(compareExtensions)
      .map((scenario) => renderExtension(state, projectId, scenario, actorStore))
  );
  return ["## Extensions", ...(rendered.length === 0 ? ["None recorded."] : rendered)].join("\n\n");
}

function compareExtensions(left: StoredScenario, right: StoredScenario) {
  const leftKey = extensionSortKey(left.extension_point ?? "*z");
  const rightKey = extensionSortKey(right.extension_point ?? "*z");
  return leftKey.parent - rightKey.parent || leftKey.suffix.localeCompare(rightKey.suffix);
}

function extensionSortKey(point: string) {
  const anyStep = point.startsWith("*");
  return {
    parent: anyStep ? Number.MAX_SAFE_INTEGER : Number.parseInt(point, 10),
    suffix: point.at(-1) ?? ""
  };
}

async function renderExtension(
  state: SignupState,
  projectId: string,
  scenario: StoredScenario,
  actorStore: ActorStore
) {
  const point = scenario.extension_point ?? "*a";
  const steps = await Promise.all(
    scenarioSteps(state, scenario.id).map((step, index) =>
      stepLine(actorStore, projectId, step, `- ${point}${String(index + 1)}.`))
  );
  return [
    `### ${point}. ${scenario.condition ?? "Extension"}`,
    ...steps,
    `- (Outcome: ${scenario.outcome} — use case ends.)`
  ].join("\n\n");
}

function scenarioSteps(state: SignupState, scenarioId: string | undefined): StoredStep[] {
  return [...(state.stepsByScenarioId.get(scenarioId ?? "") ?? [])]
    .sort((left, right) => left.step_number - right.step_number);
}

async function stepLine(
  actorStore: ActorStore,
  projectId: string,
  step: StoredStep,
  label: string
) {
  return `${label} **${await actorName(actorStore, projectId, step.actor_id)}** ${step.action}`;
}

async function actorName(actorStore: ActorStore, projectId: string, actorId: string) {
  return (await actorStore.findActorById(projectId, actorId))?.name ?? "System";
}
