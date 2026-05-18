import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredMembership,
  StoredStakeholder
} from "./signup-types.js";

const stakeholderRequestSchema = z.object({
  description: z.string().default(""),
  name: z.string().min(1),
  type: z.enum(["INTERNAL", "EXTERNAL", "REGULATORY"])
});

export function registerStakeholderRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/projects/:projectId/stakeholders", (request, reply) =>
    createStakeholder(request, reply, state)
  );
}

function createStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const projectId = projectIdFrom(request.params);
  if (membershipForProject(request, state, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const parsed = stakeholderRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder request"));
  }

  const existing = activeStakeholderNamed(state, projectId, parsed.data.name);
  if (existing !== undefined) {
    return reply.code(422).send(
      problem(
        422,
        "Stakeholder name already exists",
        { existing_stakeholder_id: existing.id },
        [
          {
            command: "vspec stakeholder edit",
            reason: "Amend the existing stakeholder."
          }
        ]
      )
    );
  }

  const stakeholder: StoredStakeholder = {
    id: randomUUID(),
    project_id: projectId,
    name: parsed.data.name,
    type: parsed.data.type,
    description: parsed.data.description,
    archived_at: null
  };
  const revision = {
    id: randomUUID(),
    entity_type: "STAKEHOLDER" as const,
    entity_id: stakeholder.id,
    version_number: 1,
    snapshot: stakeholder
  };

  state.stakeholdersByProjectId.set(projectId, [
    ...(state.stakeholdersByProjectId.get(projectId) ?? []),
    stakeholder
  ]);
  state.revisionsByEntityId.set(stakeholder.id, [revision]);

  return reply.code(201).send({
    stakeholder,
    revision,
    recommended_next_command: "vspec usecase add-stakeholder"
  });
}

function activeStakeholderNamed(
  state: SignupState,
  projectId: string,
  name: string
): StoredStakeholder | undefined {
  return (state.stakeholdersByProjectId.get(projectId) ?? []).find(
    (stakeholder) => stakeholder.name === name && stakeholder.archived_at === null
  );
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

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
