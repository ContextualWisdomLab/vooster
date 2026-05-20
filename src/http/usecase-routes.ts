import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authorUseCase } from "../application/usecases.js";
import { projectIdFrom } from "./goal-support.js";
import { membershipForProject } from "./membership-support.js";
import {
  sendUseCaseAuthoringResult,
  useCaseCreateAccessProblem
} from "./usecase-results.js";
import { problem } from "./signup-support.js";
import { createUseCaseFromGoal } from "./usecase-from-goal.js";
import { authenticatedUserId } from "./session-support.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const useCaseRequestSchema = z.object({
  force: z.boolean().default(false),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]).default("USER_GOAL"),
  primary_actor: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2"),
  scope: z.string().optional(),
  simulate_key_collision_once: z.boolean().default(false),
  title: z.string().min(1)
});
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
  const parsed = useCaseRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid use case request"));
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
