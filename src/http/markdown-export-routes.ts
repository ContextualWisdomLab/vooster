import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredScenario, StoredStep, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

const paramsSchema = z.object({ id: z.string().min(1) });

export function registerMarkdownExportRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/usecases/:id/export/markdown", (request, reply) =>
    exportMarkdown(request, reply, state)
  );
}

function exportMarkdown(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const usecaseId = paramsSchema.parse(request.params).id;
  const found = useCaseWithProjectId(state, usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to export markdown"));
  }
  return reply.type("text/markdown").send(renderMarkdown(state, found.projectId, found.usecase));
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
    .sort((left, right) => (left.extension_point ?? "").localeCompare(right.extension_point ?? ""))
    .map((scenario) => renderExtension(state, projectId, scenario));
  return ["## Extensions", ...(rendered.length === 0 ? ["None recorded."] : rendered)].join("\n\n");
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
