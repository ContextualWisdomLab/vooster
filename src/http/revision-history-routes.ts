import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  project_id: z.string().optional(),
  simulate_server_error: z.literal("true").optional()
});

export function registerRevisionHistoryRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  app.get("/v1/usecases/:usecaseId/revisions", (request, reply) =>
    listHistory(request, reply, state, membershipStore, projectStore, useCaseStore)
  );
}

async function listHistory(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = historyQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid history request"));
  }
  const found = await useCaseStore.findUseCaseWithProject(params.usecaseId);
  if (found === undefined) {
    const projectKey = await projectKeyFor(projectStore, parsed.data.project_id);
    return reply.code(404).send(missingHistoryProblem(projectKey));
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (
    userId === undefined ||
    await membershipForProject(request, state, membershipStore, found.projectId) === undefined
  ) {
    return reply.code(403).send(historyAccessProblem());
  }
  if (parsed.data.simulate_server_error === "true") {
    return reply.code(500).send(historyReadFailureProblem(found.usecase));
  }

  const allRows = revisionsFor(state, found.usecase)
    .sort((left, right) => right.version_number - left.version_number)
    .map((revision) => revisionRow(revision, userId));
  const revisions = allRows.slice(0, parsed.data.limit);
  return reply.send({
    limit: parsed.data.limit,
    revisions,
    suggested_next_actions: nextActions(found.usecase, revisions, allRows.length - revisions.length),
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

function historyAccessProblem() {
  return problem(
    403,
    "Not authorized to view revision history",
    {},
    [
      {
        command: "vspec login",
        reason: "Authenticate with an account that has project access."
      },
      {
        command: "vspec member set-role",
        reason: "Ask a workspace owner for read access."
      }
    ]
  );
}

function historyReadFailureProblem(usecase: StoredUseCase) {
  return problem(
    500,
    "Revision history read failed",
    { exit_code: 5 },
    [
      {
        command: `vspec history ${usecase.key} --retry`,
        reason: "Retry the history request."
      }
    ]
  );
}

async function projectKeyFor(
  projectStore: ProjectStore,
  projectId: string | undefined
): Promise<string> {
  if (projectId === undefined) {
    return "unknown";
  }

  return (await projectStore.findProjectById(projectId))?.key ?? "unknown";
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

function nextActions(
  usecase: StoredUseCase,
  revisions: Array<ReturnType<typeof revisionRow>>,
  suppressedCount: number
) {
  const latestRevision = revisions[0]?.revision ?? usecase.current_revision_id;
  return [
    {
      command: `vspec usecase show ${usecase.key} --revision=${latestRevision}`,
      reason: "Inspect the selected revision."
    },
    {
      command: "vspec diff",
      reason: "Compare two revisions before reverting."
    },
    ...(
      suppressedCount === 0
        ? []
        : [{
            command: `vspec history ${usecase.key} --limit ${String(revisions.length + suppressedCount)}`,
            reason: "Rerun with a larger limit to include suppressed rows."
          }]
    )
  ];
}
