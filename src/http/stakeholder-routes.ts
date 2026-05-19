import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredStakeholder
} from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";

const stakeholderRequestSchema = z.object({
  attach_to_step: z.boolean().optional(),
  description: z.string().default(""),
  name: z.string().min(1),
  type: z.string()
});

const stakeholderTypes = ["INTERNAL", "EXTERNAL", "REGULATORY"] as const;

export function registerStakeholderRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  app.post("/v1/projects/:projectId/stakeholders", (request, reply) =>
    createStakeholder(request, reply, state, membershipStore, projectStore)
  );
}

async function createStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const projectId = projectIdFrom(request.params);
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const parsed = stakeholderRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder request"));
  }

  if (await projectWorkspaceArchived(state, projectStore, projectId)) {
    return reply.code(409).send(problem(409, "Workspace has been archived"));
  }

  if (parsed.data.attach_to_step === true) {
    return reply.code(400).send(
      problem(400, "Actors do; stakeholders care", {}, [
        { command: "vspec actor create", reason: "Create an actor for step actions." }
      ])
    );
  }

  if (!isStakeholderType(parsed.data.type)) {
    return reply.code(400).send(
      problem(400, "Invalid stakeholder type", {
        valid_types: [...stakeholderTypes]
      })
    );
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

function isStakeholderType(type: string): type is StoredStakeholder["type"] {
  return stakeholderTypes.includes(type as StoredStakeholder["type"]);
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

async function projectWorkspaceArchived(
  state: SignupState,
  projectStore: ProjectStore,
  projectId: string
): Promise<boolean> {
  const project = await projectStore.findProjectById(projectId);
  return project !== undefined && state.workspaceArchivedAt.has(project.workspace_id);
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
