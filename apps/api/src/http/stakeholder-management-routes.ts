import type { FastifyReply, FastifyRequest } from "fastify";
import {
  stakeholderArchiveResponseSchema,
  stakeholderListResponseSchema,
  stakeholderParamsSchema,
  stakeholderPatchRequestSchema,
  stakeholderProjectParamsSchema,
  stakeholderResponseSchema,
  stakeholderTypeSchema,
  type StakeholderPatchRequest
} from "@vooster/contracts";

import { problem } from "./signup-support.js";
import type { StoredStakeholder } from "../domain/entities/index.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";

export async function listStakeholders(
  request: FastifyRequest,
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const projectId = stakeholderProjectParamsSchema.parse(request.params).projectId;
  const stakeholders = (await stakeholderStore.listStakeholders(projectId)).filter(
    (stakeholder) => stakeholder.archived_at === null
  );
  return reply.send(
    stakeholderListResponseSchema.parse({
      items: stakeholders.map(stakeholderResponse)
    })
  );
}

export async function showStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const params = stakeholderParamsFrom(request.params);
  const stakeholder = await stakeholderStore.findStakeholderById(
    params.projectId,
    params.stakeholderId
  );
  if (stakeholder === undefined) {
    return reply.code(404).send(problem(404, "Stakeholder not found"));
  }
  return reply.send(
    stakeholderResponseSchema.parse({ stakeholder: stakeholderResponse(stakeholder) })
  );
}

export async function patchStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const params = stakeholderParamsFrom(request.params);
  const parsed = stakeholderPatchRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder update"));
  }
  const stakeholder = await stakeholderFor(params, reply, stakeholderStore);
  if (stakeholder === undefined || stakeholderStore.updateStakeholder === undefined) {
    return stakeholder;
  }
  const updated = { ...stakeholder, ...stakeholderPatchFrom(stakeholder, parsed.data) };
  await stakeholderStore.updateStakeholder(updated);
  return reply.send(
    stakeholderResponseSchema.parse({ stakeholder: stakeholderResponse(updated) })
  );
}

export async function archiveStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const params = stakeholderParamsFrom(request.params);
  const stakeholder = await stakeholderFor(params, reply, stakeholderStore);
  if (stakeholder === undefined || stakeholderStore.updateStakeholder === undefined) {
    return stakeholder;
  }
  await stakeholderStore.updateStakeholder({
    ...stakeholder,
    archived_at: new Date().toISOString()
  });
  return reply.send(
    stakeholderArchiveResponseSchema.parse({
      archived: true,
      stakeholder: { id: params.stakeholderId }
    })
  );
}

async function stakeholderFor(
  params: { projectId: string; stakeholderId: string },
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const stakeholder = await stakeholderStore.findStakeholderById(
    params.projectId,
    params.stakeholderId
  );
  if (stakeholder === undefined) {
    void reply.code(404).send(problem(404, "Stakeholder not found"));
    return undefined;
  }
  if (stakeholderStore.updateStakeholder === undefined) {
    void reply.code(500).send(problem(500, "Stakeholder updates are not configured"));
    return undefined;
  }
  return stakeholder;
}

function stakeholderPatchFrom(
  stakeholder: StoredStakeholder,
  patch: StakeholderPatchRequest
): Partial<StoredStakeholder> {
  return {
    description: patch.description ?? stakeholder.description,
    name: patch.name ?? stakeholder.name,
    type: patch.type === undefined ? stakeholder.type : stakeholderTypeFrom(patch.type)
  };
}

function stakeholderTypeFrom(type: string): StoredStakeholder["type"] {
  return stakeholderTypeSchema.parse(type);
}

function stakeholderParamsFrom(params: unknown): {
  projectId: string;
  stakeholderId: string;
} {
  return stakeholderParamsSchema.parse(params);
}

function stakeholderResponse(stakeholder: StoredStakeholder) {
  return {
    description: stakeholder.description,
    id: stakeholder.id,
    name: stakeholder.name,
    type: stakeholder.type
  };
}
