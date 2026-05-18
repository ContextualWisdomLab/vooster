import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { goalWithProjectId } from "./goal-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredMembership,
  StoredUseCase
} from "./signup-types.js";

export function registerGoalPromotionRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/goals/:goalId/promote", (request, reply) =>
    promoteGoal(request, reply, state)
  );
}

function promoteGoal(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = goalWithProjectId(state, goalIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Goal not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const project = state.projectsById.get(found.projectId);
  if (project === undefined) {
    return reply.code(404).send(problem(404, "Project not found"));
  }
  if (found.goal.linked_usecase_id !== null) {
    return reply.code(409).send(
      problem(409, "Goal is already promoted", {
        existing_usecase_key:
          useCaseWithId(state, found.projectId, found.goal.linked_usecase_id)?.key
      })
    );
  }

  const usecase: StoredUseCase = {
    id: randomUUID(),
    project_id: found.projectId,
    key: nextUseCaseKey(state, found.projectId, project.key),
    title: found.goal.description,
    level: found.goal.level,
    format: "BRIEF",
    primary_actor_id: found.goal.actor_id,
    status: "DRAFT",
    archived_at: null
  };
  const revision = useCaseRevision(usecase, `Promoted from goal ${found.goal.id}`);

  state.usecasesByProjectId.set(found.projectId, [
    ...(state.usecasesByProjectId.get(found.projectId) ?? []),
    usecase
  ]);
  state.revisionsByEntityId.set(usecase.id, [revision]);
  found.goal.status = "PROMOTED";
  found.goal.linked_usecase_id = usecase.id;

  return reply.code(201).send({
    usecase,
    revision,
    goal: found.goal,
    suggested_next_actions: [
      {
        command: "vspec usecase add-stakeholder",
        reason: "Attach stakeholders and interests."
      },
      { command: "vspec scenario main", reason: "Write the main success scenario." }
    ]
  });
}

function nextUseCaseKey(state: SignupState, projectId: string, projectKey: string): string {
  const nextNumber = (state.usecasesByProjectId.get(projectId) ?? []).length + 1;
  return `${projectKey}-${String(nextNumber).padStart(3, "0")}`;
}

function useCaseWithId(
  state: SignupState,
  projectId: string,
  usecaseId: string
): StoredUseCase | undefined {
  return (state.usecasesByProjectId.get(projectId) ?? []).find(
    (usecase) => usecase.id === usecaseId
  );
}

function useCaseRevision(usecase: StoredUseCase, changeSummary: string) {
  return {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: usecase.id,
    version_number: 1,
    snapshot: { ...usecase },
    change_summary: changeSummary
  };
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

function goalIdFrom(params: unknown): string {
  return z.object({ goalId: z.string().min(1) }).parse(params).goalId;
}
