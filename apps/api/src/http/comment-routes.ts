import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  commentAddQuerySchema,
  commentBodySchema,
  commentIdParamsSchema,
  commentPatchSchema,
  usecaseCommentParamsSchema
} from "@vooster/contracts";
import {
  addComment as addUseCaseComment,
  deleteComment as deleteUseCaseComment,
  listComments as listUseCaseComments,
  patchComment as patchUseCaseComment
} from "../application/comments.js";
import type { CommentStore } from "../ports/comment-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import { emptyBodyProblem } from "./comment-problems.js";
import { sendCommentResult } from "./comment-results.js";
import { authenticatedUserId } from "./session-support.js";
import type { SignupState } from "./signup-types.js";

export function registerCommentRoutes(
  app: FastifyInstance,
  state: SignupState,
  commentStore: CommentStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/usecases/:usecaseId/comments", (request, reply) =>
    addComment(request, reply, state, commentStore, membershipStore, useCaseStore)
  );
  app.get("/v1/usecases/:usecaseId/comments", (request, reply) =>
    listComments(request, reply, state, commentStore, membershipStore, useCaseStore)
  );
  app.patch("/v1/comments/:commentId", (request, reply) =>
    patchComment(request, reply, state, commentStore, membershipStore, useCaseStore)
  );
  app.delete("/v1/comments/:commentId", (request, reply) =>
    deleteComment(request, reply, state, commentStore, membershipStore, useCaseStore)
  );
}

async function addComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  commentStore: CommentStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const parsed = commentBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(422).send(emptyBodyProblem());
  }
  return sendCommentResult(
    reply,
    await addUseCaseComment(deps(commentStore, membershipStore, useCaseStore), {
      body: parsed.data.body,
      dryRun: commentAddQuerySchema.parse(request.query),
      simulateWriteFailure: parsed.data.simulate_write_failure,
      usecaseId: usecaseId(request),
      userId: userId(request, state)
    })
  );
}

async function listComments(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  commentStore: CommentStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  return sendCommentResult(
    reply,
    await listUseCaseComments(deps(commentStore, membershipStore, useCaseStore), {
      usecaseId: usecaseId(request),
      userId: userId(request, state)
    })
  );
}

async function patchComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  commentStore: CommentStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const parsed = commentPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(422).send(emptyBodyProblem());
  }
  return sendCommentResult(
    reply,
    await patchUseCaseComment(deps(commentStore, membershipStore, useCaseStore), {
      body: parsed.data.body,
      commentId: commentId(request),
      resolved: parsed.data.resolved,
      userId: userId(request, state)
    })
  );
}

async function deleteComment(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  commentStore: CommentStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  return sendCommentResult(
    reply,
    await deleteUseCaseComment(deps(commentStore, membershipStore, useCaseStore), {
      commentId: commentId(request),
      userId: userId(request, state)
    })
  );
}

function deps(
  commentStore: CommentStore,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  return { commentStore, membershipStore, useCaseStore };
}

function usecaseId(request: FastifyRequest) {
  return usecaseCommentParamsSchema.parse(request.params).usecaseId;
}

function commentId(request: FastifyRequest) {
  return commentIdParamsSchema.parse(request.params).commentId;
}

function userId(request: FastifyRequest, state: SignupState) {
  return authenticatedUserId(request.headers.cookie, state.sessionsByToken);
}
