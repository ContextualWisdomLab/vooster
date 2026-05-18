import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

type CommentPayload = {
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
type CommentResponse = {
  comment: CommentPayload;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type CommentListResponse = { comments: CommentPayload[] };
type CommentProblem = {
  code?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-028 - Comment on a use case", () => {
  test("MAIN: add, list, edit, resolve, and delete own comment", async () => {
    const setup = await createProject(server, "Comment Main", "comment-main", "stub-comment-main");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews comments");

    const added = await addComment(usecase.id, setup.cookie, "**Review** this flow");

    expect(added.status).toBe(201);
    const addBody = (await added.json()) as CommentResponse;
    expect(addBody.comment).toMatchObject({
      author_id: setup.userId,
      body: "**Review** this flow",
      resolved: false,
      resolved_at: null,
      target_id: usecase.id,
      target_type: "USECASE",
      updated_at: null
    });
    expect(Date.parse(addBody.comment.created_at)).not.toBeNaN();
    expect(addBody.suggested_next_actions).toContainEqual({
      command: `vspec comment list ${usecase.key}`,
      reason: "Review open comments for this use case."
    });

    expect((await listComments(usecase.id, setup.cookie)).comments).toEqual([addBody.comment]);

    const edited = await patchComment(addBody.comment.id, setup.cookie, { body: "_Resolved in spec._" });
    const editBody = (await edited.json()) as CommentResponse;
    expect(edited.status).toBe(200);
    expect(editBody.comment.body).toBe("_Resolved in spec._");
    expect(Date.parse(editBody.comment.updated_at ?? "")).not.toBeNaN();

    const resolved = await patchComment(addBody.comment.id, setup.cookie, { resolved: true });
    const resolveBody = (await resolved.json()) as CommentResponse;
    expect(resolved.status).toBe(200);
    expect(resolveBody.comment.resolved).toBe(true);
    expect(Date.parse(resolveBody.comment.resolved_at ?? "")).not.toBeNaN();

    const deleted = await deleteComment(addBody.comment.id, setup.cookie);
    expect(deleted.status).toBe(200);
    expect((await listComments(usecase.id, setup.cookie)).comments).toEqual([]);
  });

  test("3a: whitespace-only body is rejected without inserting a comment", async () => {
    const setup = await createProject(server, "Comment Empty", "comment-empty", "stub-comment-empty");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews empty comments");

    const response = await addComment(usecase.id, setup.cookie, "   ");

    expect(response.status).toBe(422);
    const problem = (await response.json()) as CommentProblem;
    expect(problem.code).toBe("empty_body");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec comment add --body \"<text>\"",
      reason: "Provide a non-empty markdown body."
    });
    expect((await listComments(usecase.id, setup.cookie)).comments).toEqual([]);
  });

  test("3b: missing or archived target returns use case list guidance", async () => {
    const setup = await createProject(server, "Comment Missing", "comment-missing", "stub-comment-missing");
    await createActor(server, setup, "Customer");
    const archived = await createUseCase(server, setup, "Customer", "Reviews archived comments");
    await server.fetch(`/__test/usecases/${archived.id}/archive`, { method: "POST" });

    const missing = await addComment("usecase-missing", setup.cookie, "Review this");
    expect(missing.status).toBe(404);
    const missingProblem = (await missing.json()) as CommentProblem;
    expect(missingProblem.suggested_next_actions).toContainEqual({
      command: "vspec usecase list",
      reason: "Find a valid non-archived use case."
    });

    const archivedResponse = await addComment(archived.id, setup.cookie, "Review archived");
    expect(archivedResponse.status).toBe(404);
    const archivedProblem = (await archivedResponse.json()) as CommentProblem;
    expect(archivedProblem.suggested_next_actions).toContainEqual({
      command: "vspec usecase list",
      reason: "Find a valid non-archived use case."
    });
  });
});

function addComment(usecaseId: string, cookie: string, body: string) {
  return server.fetch(`/v1/usecases/${usecaseId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ body })
  });
}

async function listComments(usecaseId: string, cookie: string) {
  const response = await server.fetch(`/v1/usecases/${usecaseId}/comments`, {
    headers: { Cookie: cookie }
  });
  return (await response.json()) as CommentListResponse;
}

function patchComment(commentId: string, cookie: string, body: Record<string, unknown>) {
  return server.fetch(`/v1/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}

function deleteComment(commentId: string, cookie: string) {
  return server.fetch(`/v1/comments/${commentId}`, {
    method: "DELETE",
    headers: { Cookie: cookie }
  });
}
