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
import { useCaseWithProjectId } from "./usecase-support.js";

const paramsSchema = z.object({ id: z.string().min(1) });
const exportSchema = z.object({
  existing_file_content: z.string().optional(),
  force: z.boolean().default(false),
  output_path: z.string().optional(),
  revision_id: z.string().optional()
});

export function registerMarkdownExportRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/usecases/:id/export/markdown", (request, reply) =>
    exportMarkdown(request, reply, state)
  );
}

function exportMarkdown(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const usecaseId = paramsSchema.parse(request.params).id;
  const parsed = exportSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid markdown export request"));
  }
  const found = useCaseWithProjectId(state, usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to export markdown"));
  }
  if (
    parsed.data.revision_id !== undefined &&
    !hasRevision(state, found.usecase, parsed.data.revision_id)
  ) {
    return reply.code(404).send(missingMarkdownRevisionProblem(found.usecase, parsed.data.revision_id));
  }
  const prerequisiteProblem = markdownPrerequisiteProblem(state, found.usecase);
  if (prerequisiteProblem !== undefined) {
    return reply.code(422).send(prerequisiteProblem);
  }
  const outputProblem = outputPathProblem(parsed.data.output_path);
  if (outputProblem !== undefined) {
    return reply.code(400).send(outputProblem);
  }
  const markdown = renderMarkdown(state, found.projectId, found.usecase);
  if (parsed.data.existing_file_content !== undefined && !parsed.data.force) {
    return reply.code(409).send(existingOutputProblem(parsed.data.existing_file_content, markdown));
  }
  return reply
    .header("x-vspec-round-trip-self-check", "passed")
    .type("text/markdown")
    .send(markdown);
}

function renderMarkdown(state: SignupState, projectId: string, usecase: StoredUseCase) {
  return [
    frontmatter(state, projectId, usecase),
    `# ${usecase.title}`,
    stakeholderSection(state, projectId, usecase.id),
    "## Preconditions\n\n- None recorded.",
    "## Trigger\n\nNot recorded.",
    mainScenarioSection(state, projectId, usecase.id),
    extensionSection(state, projectId, usecase.id),
    "## Success Guarantee\n\nNot recorded.",
    "## Minimal Guarantee\n\nNot recorded.",
    "## Notes\n"
  ].join("\n\n");
}

function markdownPrerequisiteProblem(state: SignupState, usecase: StoredUseCase) {
  const main = scenarios(state, usecase.id).find((scenario) => scenario.type === "MAIN_SUCCESS");
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

function frontmatter(state: SignupState, projectId: string, usecase: StoredUseCase) {
  return `---\nvspec_format: 1\ntype: usecase\nid: ${usecase.id}\nkey: ${usecase.key}\ntitle: ${usecase.title}\nlevel: ${usecase.level}\nformat: ${usecase.format}\nstatus: ${usecase.status}\npriority: ${usecase.priority}\nscope: ${usecase.scope}\nprimary_actor: ${actorName(state, projectId, usecase.primary_actor_id)}\nrevision: ${usecase.current_revision_id}\n---`;
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

function mainScenarioSection(state: SignupState, projectId: string, usecaseId: string) {
  const scenario = scenarios(state, usecaseId).find((candidate) => candidate.type === "MAIN_SUCCESS");
  const lines = scenarioSteps(state, scenario?.id).map((step, index) =>
    `${String(index + 1)}. **${actorName(state, projectId, step.actor_id)}** ${step.action}`);
  return ["## Main Success Scenario", ...(lines.length === 0 ? ["1. **System** Not recorded."] : lines)]
    .join("\n\n");
}

function extensionSection(state: SignupState, projectId: string, usecaseId: string) {
  const rendered = scenarios(state, usecaseId)
    .filter((scenario) => scenario.type === "EXTENSION")
    .sort(compareExtensions)
    .map((scenario) => renderExtension(state, projectId, scenario));
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

function renderExtension(state: SignupState, projectId: string, scenario: StoredScenario) {
  const point = scenario.extension_point ?? "*a";
  const steps = scenarioSteps(state, scenario.id).map((step, index) =>
    `- ${point}${String(index + 1)}. **${actorName(state, projectId, step.actor_id)}** ${step.action}`);
  return [
    `### ${point}. ${scenario.condition ?? "Extension"}`,
    ...steps,
    `- (Outcome: ${scenario.outcome} — use case ends.)`
  ].join("\n\n");
}

function scenarios(state: SignupState, usecaseId: string): StoredScenario[] {
  return state.scenariosByUseCaseId.get(usecaseId) ?? [];
}

function scenarioSteps(state: SignupState, scenarioId: string | undefined): StoredStep[] {
  return [...(state.stepsByScenarioId.get(scenarioId ?? "") ?? [])]
    .sort((left, right) => left.step_number - right.step_number);
}

function actorName(state: SignupState, projectId: string, actorId: string) {
  return (state.actorsByProjectId.get(projectId) ?? [])
    .find((actor) => actor.id === actorId)?.name ?? "System";
}
