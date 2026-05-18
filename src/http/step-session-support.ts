import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { problem } from "./signup-support.js";
import type { SignupState, StoredWorkSession } from "./signup-types.js";

const sessionBodySchema = z.object({
  id: z.string().min(1),
  pinned_revision_id: z.string().min(1)
});

export function createTestWorkSession(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
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
  state.workSessionsByUseCaseId.set(params.usecaseId, [
    ...(state.workSessionsByUseCaseId.get(params.usecaseId) ?? []),
    session
  ]);
  return reply.code(201).send({ session });
}

export function affectedSessionIds(state: SignupState, usecaseId: string): string[] {
  return (state.workSessionsByUseCaseId.get(usecaseId) ?? [])
    .map((session) => session.id);
}
