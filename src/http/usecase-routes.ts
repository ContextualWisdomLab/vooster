import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { activeActorNamed, projectIdFrom } from "./goal-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { restoreArchivedUseCase } from "./usecase-archive-routes.js";
import { createUseCaseFromGoal } from "./usecase-from-goal.js";
import {
  nextUseCaseKey,
  useCaseNextActions,
  useCaseRevision,
  useCaseWithProjectId
} from "./usecase-support.js";
import type {
  SignupState,
  StoredMembership,
  StoredUseCase
} from "./signup-types.js";

const useCaseRequestSchema = z.object({
  force: z.boolean().default(false),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]).default("USER_GOAL"),
  primary_actor: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2"),
  scope: z.string().optional(),
  simulate_key_collision_once: z.boolean().default(false),
  title: z.string().min(1)
});
const useCasePatchSchema = z.object({
  archived_at: z.null().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED"]).optional()
});

export function registerUseCaseRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/usecases", (request, reply) =>
    createUseCase(request, reply, state)
  );
  app.patch("/v1/usecases/:usecaseId", (request, reply) =>
    patchUseCase(request, reply, state)
  );
}

function createUseCase(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  if (membershipForProject(request, state, projectId) === undefined) {
    return reply.code(403).send(
      problem(403, "Not authorized to create use cases in this project", {}, [
        {
          command: "vspec login",
          reason: "Authenticate with an account that has project access."
        },
        {
          command: "vspec member set-role",
          reason: "Ask a workspace owner for editor access."
        }
      ])
    );
  }
  const fromGoal = createUseCaseFromGoal(request, reply, state, projectId);
  if (fromGoal !== undefined) {
    return fromGoal;
  }
  const parsed = useCaseRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid use case request"));
  }
  if (!parsed.data.force && !titleLooksLikeVerbPhrase(parsed.data.title)) {
    return reply.code(422).send(
      problem(
        422,
        "Use case title should be a verb phrase",
        { suggested_titles: suggestedTitles(parsed.data.title) },
        [
          {
            command: "vspec usecase create --force",
            reason: "Create anyway after reviewing the title."
          }
        ]
      )
    );
  }
  const project = state.projectsById.get(projectId);
  if (project === undefined) {
    return reply.code(404).send(problem(404, "Project not found"));
  }
  const actor = activeActorNamed(state, projectId, parsed.data.primary_actor);
  if (actor === undefined) {
    return reply.code(422).send(
      problem(
        422,
        "Primary actor is not available",
        { actor_name: parsed.data.primary_actor },
        [
          { command: "vspec actor list", reason: "Find a valid actor for this project." },
          {
            command: `vspec actor create --name ${parsed.data.primary_actor}`,
            reason: "Create the actor before authoring the use case."
          }
        ]
      )
    );
  }

  const usecase: StoredUseCase = {
    id: randomUUID(),
    project_id: projectId,
    key: nextUseCaseKey(
      state,
      projectId,
      project.key,
      parsed.data.simulate_key_collision_once ? 1 : 0
    ),
    title: parsed.data.title,
    level: parsed.data.level,
    format: "BRIEF",
    scope: parsed.data.scope ?? project.key.toLowerCase(),
    primary_actor_id: actor.id,
    priority: parsed.data.priority,
    status: "DRAFT",
    current_revision_id: "",
    archived_at: null
  };
  const revision = useCaseRevision(usecase);
  usecase.current_revision_id = revision.id;
  revision.snapshot = { ...usecase };

  state.usecasesByProjectId.set(projectId, [
    ...(state.usecasesByProjectId.get(projectId) ?? []),
    usecase
  ]);
  state.revisionsByEntityId.set(usecase.id, [revision]);

  return reply.code(201).send({
    usecase,
    revision,
    suggested_next_actions: useCaseNextActions(usecase.key)
  });
}

function patchUseCase(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = useCaseWithProjectId(state, usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = useCasePatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid use case update"));
  }
  if (parsed.data.archived_at === null) {
    return restoreArchivedUseCase(reply, state, found);
  }
  if (
    parsed.data.status !== undefined &&
    parsed.data.status !== "DRAFT" &&
    (state.stakeholderInterestsByUseCaseId.get(found.usecase.id) ?? []).length === 0
  ) {
    return reply
      .code(422)
      .send(problem(422, "Use case needs at least one stakeholder interest"));
  }

  return reply.send({ usecase: found.usecase });
}

function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (project === undefined || userId === undefined) {
    return undefined;
  }

  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}

function titleLooksLikeVerbPhrase(title: string): boolean {
  return /^(adds?|approves?|cancels?|creates?|places?|promotes?|renews?|requests?|reviews?|submits?|tracks?|writes?)\b/i.test(
    title
  );
}

function suggestedTitles(title: string): string[] {
  return [`Reviews ${title.charAt(0).toLowerCase()}${title.slice(1)}`];
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
