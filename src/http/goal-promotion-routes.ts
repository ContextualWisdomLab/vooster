import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import {
  nextUseCaseKey,
  useCaseRevision,
} from "./usecase-support.js";
import type {
  SignupState,
  StoredGoal,
  StoredUseCase
} from "./signup-types.js";
import type { GoalStore } from "../ports/goal-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const promoteRequestSchema = z.object({
  simulate_usecase_insert_failure: z.boolean().optional()
});

export function registerGoalPromotionRoutes(
  app: FastifyInstance,
  state: SignupState,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/goals/:goalId/promote", (request, reply) =>
    promoteGoal(request, reply, state, goalStore, membershipStore, projectStore, useCaseStore)
  );
}

async function promoteGoal(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  goalStore: GoalStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore
) {
  const goal = await goalStore.findGoalById(goalIdFrom(request.params));
  if (goal === undefined) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }
  if (await membershipForProject(request, state, membershipStore, goal.project_id) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = promoteRequestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid promotion request"));
  }

  return promoteGoalToUseCase(reply, state, goalStore, projectStore, useCaseStore, { goal, projectId: goal.project_id }, {
    simulateUseCaseInsertFailure: parsed.data.simulate_usecase_insert_failure === true
  });
}

export async function promoteGoalToUseCase(
  reply: FastifyReply,
  state: SignupState,
  goalStore: GoalStore,
  projectStore: ProjectStore,
  useCaseStore: UseCaseStore,
  found: { goal: StoredGoal; projectId: string },
  options: { simulateUseCaseInsertFailure?: boolean } = {}
) {
  const project = await projectStore.findProjectById(found.projectId);
  if (project === undefined) {
    return reply.code(404).send(problem(404, "Project not found"));
  }
  if (found.goal.linked_usecase_id !== null) {
    return reply.code(409).send(
      problem(409, "Goal is already promoted", {
        existing_usecase_key:
          (await useCaseStore.findUseCaseById(
            found.projectId,
            found.goal.linked_usecase_id
          ))?.key
      })
    );
  }
  if (found.goal.status === "REJECTED") {
    return reply.code(422).send(
      problem(422, "Rejected goal cannot be promoted", {}, [
        {
          command: `vspec goal edit ${found.goal.id} --status in-design`,
          reason: "Reopen the goal before promotion."
        }
      ])
    );
  }
  if (options.simulateUseCaseInsertFailure === true) {
    return reply.code(500).send(
      problem(500, "Promotion failed", { exit_code: 5 }, [
        {
          command: `vspec goal promote ${found.goal.id}`,
          reason: "Retry after the server recovers."
        }
      ])
    );
  }

  const usecase: StoredUseCase = {
    id: randomUUID(),
    project_id: found.projectId,
    key: await nextUseCaseKey(useCaseStore, found.projectId, project.key),
    title: found.goal.description,
    level: found.goal.level,
    format: "BRIEF",
    scope: project.key.toLowerCase(),
    primary_actor_id: found.goal.actor_id,
    priority: found.goal.priority,
    status: "DRAFT",
    current_revision_id: "",
    archived_at: null
  };
  const revision = useCaseRevision(usecase, `Promoted from goal ${found.goal.id}`);
  usecase.current_revision_id = revision.id;
  revision.snapshot = { ...usecase };

  state.revisionsByEntityId.set(usecase.id, [revision]);
  found.goal.status = "PROMOTED";
  found.goal.linked_usecase_id = usecase.id;
  await useCaseStore.saveUseCase(usecase);
  await goalStore.updateGoal(found.goal);
  const titleWarning = titleLooksLikeVerbPhrase(usecase.title)
    ? undefined
    : { field: "title", message: "Title may not be a verb phrase." };

  return reply.code(201).send({
    usecase,
    revision,
    goal: found.goal,
    suggested_next_actions: [
      {
        command: "vspec usecase add-stakeholder",
        reason: "Attach stakeholders and interests."
      },
      { command: "vspec scenario main", reason: "Write the main success scenario." },
      ...(titleWarning === undefined
        ? []
        : [
            {
              command: `vspec usecase set ${usecase.key} --field title`,
              reason: "Revise the title into a verb phrase."
            }
          ])
    ],
    ...(titleWarning === undefined ? {} : { warnings: [titleWarning] })
  });
}

function titleLooksLikeVerbPhrase(title: string): boolean {
  return /^(adds?|approves?|cancels?|creates?|places?|promotes?|renews?|requests?|reviews?|submits?|tracks?|writes?)\b/i.test(
    title
  );
}

async function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  projectId: string
) {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined) {
    return undefined;
  }

  return membershipStore.membershipForProject(projectId, userId);
}

function goalIdFrom(params: unknown): string {
  return z.object({ goalId: z.string().min(1) }).parse(params).goalId;
}
