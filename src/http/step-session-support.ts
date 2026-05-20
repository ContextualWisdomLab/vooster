import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { StoredWorkSession } from "../domain/entities/index.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const sessionBodySchema = z.object({
  id: z.string().min(1),
  pinned_revision_id: z.string().min(1)
});

export async function createTestWorkSession(
  request: FastifyRequest,
  reply: FastifyReply,
  workSessionStore: WorkSessionStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = sessionBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid work session request"));
  }

  const session: StoredWorkSession = {
    ...parsed.data,
    status: "ACTIVE",
    usecase_id: params.usecaseId
  };
  await workSessionStore.saveWorkSession(session);
  return reply.code(201).send({ session });
}

export async function affectedSessionIds(
  workSessionStore: WorkSessionStore,
  usecaseId: string
): Promise<string[]> {
  return (await workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .map((session) => session.id);
}
