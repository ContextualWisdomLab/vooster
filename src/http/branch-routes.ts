import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredMembership, StoredProject, StoredSpecBranch } from "./signup-types.js";

const branchCreateSchema = z.object({
  from: z.string().default("main"),
  name: z.string().min(1)
});

export function registerBranchRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/branches", (request, reply) =>
    createBranch(request, reply, state)
  );
}

function createBranch(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const projectId = projectIdFrom(request.params);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (membershipForProject(state, userId, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = branchCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch request"));
  }
  if (parsed.data.from !== "main") {
    return reply.code(422).send(
      problem(422, "MVP supports single-level branches from main only", {}, [
        {
          command: `vspec branch create ${parsed.data.name} --from main`,
          reason: "Create MVP branches from main only."
        }
      ])
    );
  }

  const project = state.projectsById.get(projectId);
  const baseBranch = project === undefined ? undefined : state.branchesById.get(project.default_branch_id);
  if (project === undefined || baseBranch === undefined) {
    return reply.code(404).send(problem(404, "Project branch not found"));
  }
  const snapshot = mainHeadSnapshot(state, project);
  const branch: StoredSpecBranch = {
    id: randomUUID(),
    project_id: projectId,
    name: parsed.data.name,
    owner_type: "HUMAN",
    owner_id: userId ?? "",
    base_branch_id: baseBranch.id,
    base_revision_ids: snapshot,
    head_revision_ids: snapshot,
    status: "ACTIVE"
  };
  state.branchesById.set(branch.id, branch);

  return reply.code(201).send({
    branch,
    suggested_next_actions: [
      { command: `vspec branch checkout ${branch.name}`, reason: "Switch to the isolated branch." },
      {
        command: `vspec usecase edit ${firstUseCaseKey(state, projectId)}`,
        reason: "Start editing a use case on the branch."
      }
    ]
  });
}

function membershipForProject(
  state: SignupState,
  userId: string | undefined,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  if (project === undefined || userId === undefined) {
    return undefined;
  }
  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}

function mainHeadSnapshot(state: SignupState, project: StoredProject): Record<string, string> {
  return Object.fromEntries(
    (state.usecasesByProjectId.get(project.id) ?? []).map((usecase) => [
      usecase.id,
      latestRevisionId(state, usecase.id) ?? usecase.current_revision_id
    ])
  );
}

function latestRevisionId(state: SignupState, entityId: string): string | undefined {
  const revisions = state.revisionsByEntityId.get(entityId) ?? [];
  return revisions[revisions.length - 1]?.id;
}

function firstUseCaseKey(state: SignupState, projectId: string): string {
  return state.usecasesByProjectId.get(projectId)?.[0]?.key ?? "<KEY>";
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
