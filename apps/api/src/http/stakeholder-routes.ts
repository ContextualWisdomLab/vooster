import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import {
  archiveStakeholder,
  listStakeholders,
  patchStakeholder,
  showStakeholder
} from "./stakeholder-management-routes.js";
import { sendCreateStakeholderResult } from "./stakeholder-results.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import { createStakeholder as createStakeholderWorkflow } from "../application/stakeholders.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

const stakeholderRequestSchema = z.object({
  attach_to_step: z.boolean().optional(),
  description: z.string().default(""),
  name: z.string().min(1),
  type: z.string()
});

export function registerStakeholderRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  stakeholderStore: StakeholderStore,
  workspaceStore: WorkspaceStore
) {
  app.get("/v1/projects/:projectId/stakeholders", (request, reply) =>
    listStakeholders(request, reply, stakeholderStore)
  );
  app.get("/v1/projects/:projectId/stakeholders/:stakeholderId", (request, reply) =>
    showStakeholder(request, reply, stakeholderStore)
  );
  app.post("/v1/projects/:projectId/stakeholders", (request, reply) =>
    createStakeholder(
      request,
      reply,
      state,
      membershipStore,
      projectStore,
      revisionStore,
      stakeholderStore,
      workspaceStore
    )
  );
  app.patch("/v1/projects/:projectId/stakeholders/:stakeholderId", (request, reply) =>
    patchStakeholder(request, reply, stakeholderStore)
  );
  app.delete("/v1/projects/:projectId/stakeholders/:stakeholderId", (request, reply) =>
    archiveStakeholder(request, reply, stakeholderStore)
  );
}

async function createStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  stakeholderStore: StakeholderStore,
  workspaceStore: WorkspaceStore
) {
  const projectId = projectIdFrom(request.params);
  if (
    (await membershipForProject(request, state, membershipStore, projectId)) ===
    undefined
  ) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }

  const parsed = stakeholderRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder request"));
  }
  return sendCreateStakeholderResult(
    reply,
    await createStakeholderWorkflow(
      {
        projectStore,
        revisionStore,
        stakeholderStore,
        workspaceStore
      },
      {
        attachToStep: parsed.data.attach_to_step === true,
        description: parsed.data.description,
        name: parsed.data.name,
        projectId,
        type: parsed.data.type
      }
    )
  );
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
