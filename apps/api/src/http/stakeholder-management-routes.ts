import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { problem } from "./signup-support.js";
import type { StoredStakeholder } from "../domain/entities/index.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";

const stakeholderPatchSchema = z.object({
  description: z.string().optional(),
  name: z.string().min(1).optional(),
  type: z.string().optional()
});
const stakeholderTypes = ["EXTERNAL", "INTERNAL", "REGULATORY"] as const;

export async function listStakeholders(
  request: FastifyRequest,
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const projectId = projectIdFrom(request.params);
  const stakeholders = (await stakeholderStore.listStakeholders(projectId)).filter(
    (stakeholder) => stakeholder.archived_at === null
  );
  return reply.send({ items: stakeholders.map(stakeholderResponse) });
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
  return reply.send({ stakeholder: stakeholderResponse(stakeholder) });
}

export async function patchStakeholder(
  request: FastifyRequest,
  reply: FastifyReply,
  stakeholderStore: StakeholderStore
) {
  const params = stakeholderParamsFrom(request.params);
  const parsed = stakeholderPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder update"));
  }
  const stakeholder = await stakeholderFor(params, reply, stakeholderStore);
  if (stakeholder === undefined || stakeholderStore.updateStakeholder === undefined) {
    return stakeholder;
  }
  const updated = { ...stakeholder, ...stakeholderPatchFrom(stakeholder, parsed.data) };
  await stakeholderStore.updateStakeholder(updated);
  return reply.send({ stakeholder: stakeholderResponse(updated) });
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
  return reply.send({ archived: true, stakeholder: { id: params.stakeholderId } });
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
  patch: z.infer<typeof stakeholderPatchSchema>
): Partial<StoredStakeholder> {
  return {
    description: patch.description ?? stakeholder.description,
    name: patch.name ?? stakeholder.name,
    type: patch.type === undefined ? stakeholder.type : stakeholderTypeFrom(patch.type)
  };
}

function isStakeholderType(type: string): type is (typeof stakeholderTypes)[number] {
  return stakeholderTypes.includes(type as (typeof stakeholderTypes)[number]);
}

function stakeholderTypeFrom(type: string): (typeof stakeholderTypes)[number] {
  if (isStakeholderType(type)) {
    return type;
  }
  throw new Error("Invalid stakeholder type.");
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}

function stakeholderParamsFrom(params: unknown): {
  projectId: string;
  stakeholderId: string;
} {
  return z
    .object({ projectId: z.string().min(1), stakeholderId: z.string().min(1) })
    .parse(params);
}

function stakeholderResponse(stakeholder: StoredStakeholder) {
  return {
    description: stakeholder.description,
    id: stakeholder.id,
    name: stakeholder.name,
    type: stakeholder.type
  };
}
