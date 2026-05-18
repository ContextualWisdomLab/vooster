import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

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
const bodySchema = z.object({ body: z.string().min(1) });
const patchSchema = z.object({
  body: z.string().min(1).optional(),
  resolved: z.literal(true).optional()
});

export function registerCommentRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/usecases/:usecaseId/comments", (request, reply) =>
    addComment(request, reply, state)
  );
  app.get("/v1/usecases/:usecaseId/comments", (request, reply) =>
    listComments(request, reply, state)
  );
  app.patch("/v1/comments/:commentId", (request, reply) =>
    patchComment(request, reply, state)
  );
  app.delete("/v1/comments/:commentId", (request, reply) =>
    deleteComment(request, reply, state)
  );
}

function addComment(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = authorizedUseCase(request, reply, state);
  if (found === undefined) {
    return;
  }
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(422).send(problem(422, "empty_body"));
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

function listComments(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = authorizedUseCase(request, reply, state);
  if (found === undefined) {
    return;
  }
  return reply.send({
    comments: [...comments(state).values()].filter((comment) => comment.target_id === found.usecase.id)
  });
}

function patchComment(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = authorizedComment(request, reply, state);
  if (found === undefined) {
    return;
  }
  const parsed = patchSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(422).send(problem(422, "empty_body"));
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

function deleteComment(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const found = authorizedComment(request, reply, state);
  if (found === undefined) {
    return;
  }
  comments(state).delete(found.comment.id);
  return reply.send(commentResponse(found.comment, found.usecase));
}

function authorizedUseCase(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const found = useCaseWithProjectId(state, params.usecaseId);
  if (found === undefined || found.usecase.archived_at !== null) {
    reply.code(404).send(problem(404, "Use case not found"));
    return undefined;
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || membershipForProject(request, state, found.projectId) === undefined) {
    reply.code(403).send(problem(403, "Contact the workspace owner for access"));
    return undefined;
  }
  return { usecase: found.usecase, userId };
}

function authorizedComment(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const id = z.object({ commentId: z.string().min(1) }).parse(request.params).commentId;
  const comment = comments(state).get(id);
  const found = comment === undefined ? undefined : useCaseWithProjectId(state, comment.target_id);
  if (comment === undefined || found === undefined) {
    reply.code(404).send(problem(404, "Comment not found"));
    return undefined;
  }
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined || membershipForProject(request, state, found.projectId) === undefined) {
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
