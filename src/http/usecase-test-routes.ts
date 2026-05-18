import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

export function registerUseCaseTestRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/__test/usecases/:usecaseId/archive", (request, reply) =>
    archiveUseCase(request, reply, state)
  );
}

function archiveUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const found = useCaseWithProjectId(state, usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }

  found.usecase.archived_at = new Date().toISOString();
  return reply.send({ archived: true });
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
