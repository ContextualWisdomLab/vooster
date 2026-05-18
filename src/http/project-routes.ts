import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredMembership, StoredProject } from "./signup-types.js";

const projectRequestSchema = z.object({
  name: z.string().min(1),
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,7}$/),
  visibility: z.enum(["PRIVATE", "INTERNAL"]).default("PRIVATE")
});

export function registerProjectRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/workspaces/:workspaceId/projects", (request, reply) =>
    createProject(request, reply, state)
  );
}

function createProject(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const workspaceId = workspaceIdFrom(request.params);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  const membership = membershipFor(state, userId, workspaceId);
  if (membership === undefined) {
    return reply.code(403).send(problem(403, "Request an invitation to this workspace"));
  }

  const parsed = projectRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid project request"));
  }

  const project = newProject(workspaceId, parsed.data);
  const branch = {
    id: randomUUID(),
    project_id: project.id,
    name: "main" as const,
    owner_type: "HUMAN" as const,
    owner_id: membership.user_id,
    base_branch_id: null
  };
  project.default_branch_id = branch.id;

  state.projectsById.set(project.id, project);
  state.branchesById.set(branch.id, branch);
  recordProjectKey(state, project);

  return reply.code(201).send({
    project,
    default_branch: branch,
    recommended_next_command: "vspec actor define"
  });
}

function workspaceIdFrom(params: unknown): string {
  const parsed = z.object({ workspaceId: z.string().min(1) }).parse(params);
  return parsed.workspaceId;
}

function membershipFor(
  state: SignupState,
  userId: string | undefined,
  workspaceId: string
): StoredMembership | undefined {
  if (userId === undefined) {
    return undefined;
  }

  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === workspaceId
  );
}

function newProject(
  workspaceId: string,
  data: z.infer<typeof projectRequestSchema>
): StoredProject {
  return {
    id: randomUUID(),
    workspace_id: workspaceId,
    name: data.name,
    key: data.key,
    visibility: data.visibility,
    default_branch_id: ""
  };
}

function recordProjectKey(state: SignupState, project: StoredProject) {
  const keys =
    state.projectKeysByWorkspaceId.get(project.workspace_id) ?? new Map<string, string>();
  keys.set(project.key, project.id);
  state.projectKeysByWorkspaceId.set(project.workspace_id, keys);
}
