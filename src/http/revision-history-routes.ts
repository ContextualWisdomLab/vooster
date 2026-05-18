import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { useCaseWithProjectId } from "./usecase-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  project_id: z.string().optional()
});

export function registerRevisionHistoryRoutes(app: FastifyInstance, state: SignupState) {
  app.get("/v1/usecases/:usecaseId/revisions", (request, reply) =>
    listHistory(request, reply, state)
  );
}

function listHistory(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = historyQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid history request"));
  }
  const found = useCaseWithProjectId(state, params.usecaseId);
  if (found === undefined) {
    const projectKey = projectKeyFor(state, parsed.data.project_id);
    return reply.code(404).send(missingHistoryProblem(projectKey));
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const allRows = revisionsFor(state, found.usecase)
    .sort((left, right) => right.version_number - left.version_number)
    .map((revision) => revisionRow(revision, userId));
  const revisions = allRows.slice(0, parsed.data.limit);
  return reply.send({
    limit: parsed.data.limit,
    revisions,
    suggested_next_actions: nextActions(found.usecase, revisions),
    suppressed_count: allRows.length - revisions.length,
    truncated: allRows.length > revisions.length,
    usecase: { id: found.usecase.id, key: found.usecase.key }
  });
}

function missingHistoryProblem(projectKey: string) {
  return problem(
    404,
    "Use case not found",
    { project_key: projectKey },
    [
      {
        command: `vspec usecase list --project ${projectKey}`,
        reason: "Find a use case in the current project."
      }
    ]
  );
}

function projectKeyFor(state: SignupState, projectId: string | undefined): string {
  return state.projectsById.get(projectId ?? "")?.key ?? "unknown";
}

function revisionsFor(state: SignupState, usecase: StoredUseCase) {
  return state.revisionsByEntityId.get(usecase.id) ?? [];
}

function revisionRow(revision: StoredRevision, userId: string) {
  return {
    author: userId,
    change_summary: revision.change_summary,
    entity_id: revision.entity_id,
    entity_type: revision.entity_type,
    revision: revision.id,
    timestamp: new Date().toISOString(),
    version_number: revision.version_number
  };
}

function nextActions(usecase: StoredUseCase, revisions: Array<ReturnType<typeof revisionRow>>) {
  const latestRevision = revisions[0]?.revision ?? usecase.current_revision_id;
  return [
    {
      command: `vspec usecase show ${usecase.key} --revision=${latestRevision}`,
      reason: "Inspect the selected revision."
    },
    {
      command: "vspec diff",
      reason: "Compare two revisions before reverting."
    }
  ];
}
