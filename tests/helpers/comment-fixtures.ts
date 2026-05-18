import type { TestServer } from "./server.js";
import { createActor, createProject, createUseCase } from "./uc-fixtures.js";

export type CommentPayload = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  resolved: boolean;
  resolved_at: null | string;
  target_id: string;
  target_type: string;
  updated_at: null | string;
};
export type CommentResponse = {
  comment: CommentPayload;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
export type CommentListResponse = { comments: CommentPayload[] };
export type CommentProblem = {
  code?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

export async function createCommentFixture(
  server: TestServer,
  name: string,
  slug: string,
  code: string
) {
  const setup = await createProject(server, `Comment ${name}`, `comment-${slug}`, code);
  await createActor(server, setup, "Customer");
  const usecase = await createUseCase(server, setup, "Customer", `Reviews ${name}`);
  return { ...setup, usecase };
}

export function addComment(server: TestServer, usecaseId: string, cookie: string, body: string) {
  return server.fetch(`/v1/usecases/${usecaseId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ body })
  });
}

export async function listComments(server: TestServer, usecaseId: string, cookie: string) {
  const response = await server.fetch(`/v1/usecases/${usecaseId}/comments`, {
    headers: { Cookie: cookie }
  });
  return (await response.json()) as CommentListResponse;
}

export function patchComment(
  server: TestServer,
  commentId: string,
  cookie: string,
  body: Record<string, unknown>
) {
  return server.fetch(`/v1/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}

export function deleteComment(server: TestServer, commentId: string, cookie: string) {
  return server.fetch(`/v1/comments/${commentId}`, {
    method: "DELETE",
    headers: { Cookie: cookie }
  });
}
