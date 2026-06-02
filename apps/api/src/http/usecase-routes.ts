import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  usecaseCreateQuerySchema,
  usecaseCreateRequestSchema
} from "@vooster/contracts";
import { authorUseCase } from "../application/usecases.js";
import { projectIdFrom } from "./goal-support.js";
import { membershipForProject } from "./membership-support.js";
import {
  sendUseCaseAuthoringResult,
  useCaseCreateAccessProblem
} from "./usecase-results.js";
import { createUseCaseFromGoal } from "./usecase-from-goal.js";
import { authenticatedUserId } from "./session-support.js";
import { useCaseCreateValidationProblem } from "./usecase-validation-problem.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerUseCaseRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/projects/:projectId/usecases", (request, reply) =>
    createUseCase(
      request,
      reply,
      state,
      actorStore,
      goalStore,
      membershipStore,
      projectStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function createUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const projectId = projectIdFrom(request.params);
  if (
    (await membershipForProject(request, state, membershipStore, projectId)) ===
    undefined
  ) {
    return reply.code(403).send(useCaseCreateAccessProblem());
  }
  if (
    await createUseCaseFromGoal(
      request,
      reply,
      state,
      goalStore,
      projectStore,
      revisionStore,
      useCaseStore,
      projectId
    )
  ) {
    return undefined;
  }
  const parsed = usecaseCreateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(useCaseCreateValidationProblem(parsed.error));
  }
  return sendUseCaseAuthoringResult(
    reply,
    await authorUseCase(
      {
        actorStore,
        membershipStore,
        projectStore,
        revisionStore,
        useCaseStore
      },
      {
        dryRun: usecaseCreateQuerySchema.parse(request.query),
        force: parsed.data.force,
        level: parsed.data.level,
        primaryActor: parsed.data.primary_actor,
        priority: parsed.data.priority,
        projectId,
        scope: parsed.data.scope,
        simulateKeyCollisionOnce: parsed.data.simulate_key_collision_once,
        title: parsed.data.title,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}
