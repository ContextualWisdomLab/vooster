import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export function registerUseCaseTestRoutes(
  app: FastifyInstance,
  state: SignupState,
  useCaseStore: UseCaseStore
) {
  app.post("/__test/usecases/:usecaseId/archive", (request, reply) =>
    archiveUseCase(request, reply, useCaseStore)
  );
}

async function archiveUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  useCaseStore: UseCaseStore
) {
  const found = await useCaseStore.findUseCaseWithProject(
    usecaseIdFrom(request.params)
  );
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }

  found.usecase.archived_at = new Date().toISOString();
  await useCaseStore.updateUseCase(found.usecase);
  return reply.send({ archived: true });
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
