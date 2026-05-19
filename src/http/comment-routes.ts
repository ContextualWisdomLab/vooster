import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  commentWriteFailedProblem,
  emptyBodyProblem,
  missingUseCaseProblem,
  notOwnerProblem
} from "./comment-problems.js";
import { membershipForProject } from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type StoredComment = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  resolved: boolean;
  resolved_at: null | string;
  target_id: string;
  target_type: "USECASE";
  updated_at: null | string;
};

const commentsByState = new WeakMap<SignupState, Map<string, StoredComment>>();
const bodySchema = z.object({
  body: z.string().min(1),
  simulate_write_failure: z.boolean().optional()
});
const patchSchema = z.object({
  body: z.string().min(1).optional(),
  resolved: z.literal(true).optional()
});

export function registerCommentRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/usecases/:usecaseId/comments", (request, reply) =>
    addComment(request, reply, state, membershipStore, useCaseStore)
  );
  app.get("/v1/usecases/:usecaseId/comments", (request, reply) =>
    listComments(request, reply, state, membershipStore, useCaseStore)
  );
  app.patch("/v1/comments/:commentId", (request, reply) =>
    patchComment(request, reply, state, membershipStore, useCaseStore)
  );
  app.delete("/v1/comments/:commentId", (request, reply) =>
    deleteComment(request, reply, state, membershipStore, useCaseStore)
  );
}

async function addComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const found = await authorizedUseCase(request, reply, state, membershipStore, useCaseStore);
  if (found === undefined) {
    return;
  }
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success || parsed.data.body.trim() === "") {
    return reply.code(422).send(emptyBodyProblem());
  }
  if (parsed.data.simulate_write_failure === true) {
    return reply.code(500).send(commentWriteFailedProblem());
  }
  const now = new Date().toISOString();
  const comment: StoredComment = {
    author_id: found.userId,
    body: parsed.data.body,
    created_at: now,
    id: randomUUID(),
    resolved: false,
    resolved_at: null,
    target_id: found.usecase.id,
    target_type: "USECASE",
    updated_at: null
  };
  comments(state).set(comment.id, comment);
  return reply.code(201).send(commentResponse(comment, found.usecase));
}

async function listComments(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const found = await authorizedUseCase(request, reply, state, membershipStore, useCaseStore);
  if (found === undefined) {
    return;
  }
  return reply.send({
    comments: [...comments(state).values()].filter((comment) => comment.target_id === found.usecase.id)
  });
}

async function patchComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const found = await authorizedComment(request, reply, state, membershipStore, useCaseStore);
  if (found === undefined) {
    return;
  }
  if (found.comment.author_id !== found.userId) {
    return reply.code(403).send(notOwnerProblem());
  }
  const parsed = patchSchema.safeParse(request.body);
  if (!parsed.success || parsed.data.body?.trim() === "") {
    return reply.code(422).send(emptyBodyProblem());
  }
  if (parsed.data.body !== undefined) {
    found.comment.body = parsed.data.body;
    found.comment.updated_at = new Date().toISOString();
  }
  if (parsed.data.resolved === true && !found.comment.resolved) {
    found.comment.resolved = true;
    found.comment.resolved_at = new Date().toISOString();
  }
  return reply.send(commentResponse(found.comment, found.usecase));
}

async function deleteComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const found = await authorizedComment(request, reply, state, membershipStore, useCaseStore);
  if (found === undefined) {
    return;
  }
  if (found.comment.author_id !== found.userId) {
    return reply.code(403).send(notOwnerProblem());
  }
  comments(state).delete(found.comment.id);
  return reply.send(commentResponse(found.comment, found.usecase));
}

async function authorizedUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const found = await useCaseStore.findUseCaseWithProject(params.usecaseId);
  if (found === undefined || found.usecase.archived_at !== null) {
    reply.code(404).send(missingUseCaseProblem());
    return undefined;
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (
    userId === undefined ||
    await membershipForProject(request, state, membershipStore, found.projectId) === undefined
  ) {
    reply.code(403).send(problem(403, "Contact the workspace owner for access"));
    return undefined;
  }
  return { usecase: found.usecase, userId };
}

async function authorizedComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const id = z.object({ commentId: z.string().min(1) }).parse(request.params).commentId;
  const comment = comments(state).get(id);
  const found =
    comment === undefined
      ? undefined
      : await useCaseStore.findUseCaseWithProject(comment.target_id);
  if (comment === undefined || found === undefined) {
    reply.code(404).send(problem(404, "Comment not found"));
    return undefined;
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (
    userId === undefined ||
    await membershipForProject(request, state, membershipStore, found.projectId) === undefined
  ) {
    reply.code(403).send(problem(403, "Contact the workspace owner for access"));
    return undefined;
  }
  return { comment, usecase: found.usecase, userId };
}

function commentResponse(comment: StoredComment, usecase: StoredUseCase) {
  return {
    comment,
    suggested_next_actions: [
      {
        command: `vspec comment list ${usecase.key}`,
        reason: "Review open comments for this use case."
      },
      {
        command: `vspec usecase show ${usecase.key}`,
        reason: "Open the commented use case."
      }
    ]
  };
}

function comments(state: SignupState) {
  const existing = commentsByState.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, StoredComment>();
  commentsByState.set(state, created);
  return created;
}
