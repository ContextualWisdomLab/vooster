import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { projectIdFrom } from "./goal-support.js";
import { membershipForProject } from "./membership-support.js";
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
  StoredUseCase
} from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";

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

export function registerUseCaseRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  branchStore: BranchStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  app.post("/v1/projects/:projectId/usecases", (request, reply) =>
    createUseCase(request, reply, state, actorStore, goalStore, membershipStore, projectStore)
  );
  app.patch("/v1/usecases/:usecaseId", (request, reply) =>
    patchUseCase(request, reply, state, branchStore, membershipStore, projectStore)
  );
}

async function createUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const projectId = projectIdFrom(request.params);
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
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
  if (await createUseCaseFromGoal(request, reply, state, goalStore, projectStore, projectId)) {
    return undefined;
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
  const project = await projectStore.findProjectById(projectId);
  if (project === undefined) {
    return reply.code(404).send(problem(404, "Project not found"));
  }
  const actor = await actorStore.findActorByName(projectId, parsed.data.primary_actor);
  if (actor === undefined || actor.archived_at !== null) {
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

async function patchUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const found = useCaseWithProjectId(state, usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = useCasePatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid use case update"));
  }
  if (parsed.data.archived_at === null) {
    return restoreArchivedUseCase(reply, state, branchStore, projectStore, found);
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
