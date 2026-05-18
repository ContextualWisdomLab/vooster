import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision } from "./signup-types.js";

const branchRevisionSchema = z.object({
  severity: z.enum(["BREAKING", "COSMETIC", "NON_BREAKING"]),
  title: z.string().min(1)
});

export function registerBranchTestRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/__test/branches/:branchId/usecases/:usecaseId/revisions", (request, reply) =>
    advanceBranchUseCase(request, reply, state)
  );
}

function advanceBranchUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const params = z
    .object({ branchId: z.string().min(1), usecaseId: z.string().min(1) })
    .parse(request.params);
  const parsed = branchRevisionSchema.safeParse(request.body);
  const branch = state.branchesById.get(params.branchId);
  const usecase = [...state.usecasesByProjectId.values()]
    .flat()
    .find((candidate) => candidate.id === params.usecaseId);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch revision request"));
  }
  if (branch === undefined || usecase === undefined) {
    return reply.code(404).send(problem(404, "Branch use case not found"));
  }
  const revision: StoredRevision = {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: (state.revisionsByEntityId.get(usecase.id) ?? []).length + 1,
    snapshot: { ...usecase, title: parsed.data.title },
    severity: parsed.data.severity
  };
  branch.head_revision_ids = {
    ...(branch.head_revision_ids ?? branch.base_revision_ids ?? {}),
    [usecase.id]: revision.id
  };
  state.revisionsByEntityId.set(usecase.id, [
    ...(state.revisionsByEntityId.get(usecase.id) ?? []),
    revision
  ]);
  return reply.send({ revision_id: revision.id });
}
