import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addComment,
  createCommentFixture,
  deleteComment,
  listComments,
  patchComment,
  type CommentProblem,
  type CommentResponse
} from "../helpers/comment-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { createWorkspaceMember } from "../helpers/member-fixtures.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-028 - Comment on a use case", () => {
  test("MAIN: add, list, edit, resolve, and delete own comment", async () => {
    const setup = await createProject(server, "Comment Main", "comment-main", "stub-comment-main");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews comments");

    const added = await addComment(server, usecase.id, setup.cookie, "**Review** this flow");

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

    expect((await listComments(server, usecase.id, setup.cookie)).comments).toEqual([addBody.comment]);

    const edited = await patchComment(server, addBody.comment.id, setup.cookie, { body: "_Resolved in spec._" });
    const editBody = (await edited.json()) as CommentResponse;
    expect(edited.status).toBe(200);
    expect(editBody.comment.body).toBe("_Resolved in spec._");
    expect(Date.parse(editBody.comment.updated_at ?? "")).not.toBeNaN();

    const resolved = await patchComment(server, addBody.comment.id, setup.cookie, { resolved: true });
    const resolveBody = (await resolved.json()) as CommentResponse;
    expect(resolved.status).toBe(200);
    expect(resolveBody.comment.resolved).toBe(true);
    expect(Date.parse(resolveBody.comment.resolved_at ?? "")).not.toBeNaN();

    const deleted = await deleteComment(server, addBody.comment.id, setup.cookie);
    expect(deleted.status).toBe(200);
    expect((await listComments(server, usecase.id, setup.cookie)).comments).toEqual([]);
  });

  test("3a: whitespace-only body is rejected without inserting a comment", async () => {
    const setup = await createProject(server, "Comment Empty", "comment-empty", "stub-comment-empty");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Reviews empty comments");

    const response = await addComment(server, usecase.id, setup.cookie, "   ");

    expect(response.status).toBe(422);
    const problem = (await response.json()) as CommentProblem;
    expect(problem.code).toBe("empty_body");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec comment add --body \"<text>\"",
      reason: "Provide a non-empty markdown body."
    });
    expect((await listComments(server, usecase.id, setup.cookie)).comments).toEqual([]);
  });

  test("3b: missing or archived target returns use case list guidance", async () => {
    const setup = await createProject(server, "Comment Missing", "comment-missing", "stub-comment-missing");
    await createActor(server, setup, "Customer");
    const archived = await createUseCase(server, setup, "Customer", "Reviews archived comments");
    await server.fetch(`/__test/usecases/${archived.id}/archive`, { method: "POST" });

    const missing = await addComment(server, "usecase-missing", setup.cookie, "Review this");
    expect(missing.status).toBe(404);
    const missingProblem = (await missing.json()) as CommentProblem;
    expect(missingProblem.suggested_next_actions).toContainEqual({
      command: "vspec usecase list",
      reason: "Find a valid non-archived use case."
    });

    const archivedResponse = await addComment(server, archived.id, setup.cookie, "Review archived");
    expect(archivedResponse.status).toBe(404);
    const archivedProblem = (await archivedResponse.json()) as CommentProblem;
    expect(archivedProblem.suggested_next_actions).toContainEqual({
      command: "vspec usecase list",
      reason: "Find a valid non-archived use case."
    });
  });

  test("4b: another workspace member cannot delete the comment", async () => {
    const setup = await createCommentFixture(server, "Delete Other", "delete-other", "stub-delete-other");
    const added = await addComment(server, setup.usecase.id, setup.cookie, "Keep this");
    const addedBody = (await added.json()) as CommentResponse;
    const other = await createWorkspaceMember(
      server,
      setup.workspaceId,
      "Comment Delete Other",
      "member-delete-other",
      "stub-comment-delete-other"
    );

    const response = await deleteComment(server, addedBody.comment.id, other.cookie);

    expect(response.status).toBe(403);
    const problem = (await response.json()) as CommentProblem;
    expect(problem.code).toBe("not_owner");
    expect((await listComments(server, setup.usecase.id, setup.cookie)).comments).toEqual([
      addedBody.comment
    ]);
  });

  test("4a: resolving an already-resolved comment is an idempotent no-op", async () => {
    const setup = await createCommentFixture(server, "Resolve Again", "resolve-again", "stub-resolve-again");
    const added = await addComment(server, setup.usecase.id, setup.cookie, "Done after review");
    const addedBody = (await added.json()) as CommentResponse;

    const first = await patchComment(server, addedBody.comment.id, setup.cookie, { resolved: true });
    const firstBody = (await first.json()) as CommentResponse;
    const second = await patchComment(server, addedBody.comment.id, setup.cookie, { resolved: true });
    const secondBody = (await second.json()) as CommentResponse;

    expect(second.status).toBe(200);
    expect(secondBody.comment).toEqual(firstBody.comment);
    expect(secondBody.comment.resolved_at).toBe(firstBody.comment.resolved_at);
  });

  test("5b: another workspace member cannot edit the comment", async () => {
    const setup = await createCommentFixture(server, "Edit Other", "edit-other", "stub-edit-other");
    const added = await addComment(server, setup.usecase.id, setup.cookie, "Original body");
    const addedBody = (await added.json()) as CommentResponse;
    const other = await createWorkspaceMember(
      server,
      setup.workspaceId,
      "Comment Edit Other",
      "member-edit-other",
      "stub-comment-edit-other"
    );

    const response = await patchComment(server, addedBody.comment.id, other.cookie, { body: "Changed" });

    expect(response.status).toBe(403);
    const problem = (await response.json()) as CommentProblem;
    expect(problem.code).toBe("not_owner");
    expect((await listComments(server, setup.usecase.id, setup.cookie)).comments[0]?.body).toBe(
      "Original body"
    );
  });

  test("*a: failed comment write returns retry guidance without inserting", async () => {
    const setup = await createCommentFixture(server, "Write Failure", "write-failure", "stub-write-failure");

    const response = await addComment(
      server,
      setup.usecase.id,
      setup.cookie,
      "Persist this later",
      { simulate_write_failure: true }
    );

    expect(response.status).toBe(500);
    const problem = (await response.json()) as CommentProblem;
    expect(problem.code).toBe("comment_write_failed");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec comment add --retry",
      reason: "Retry after storage is available."
    });
    expect((await listComments(server, setup.usecase.id, setup.cookie)).comments).toEqual([]);
  });
});
