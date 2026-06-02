import { afterEach, describe, expect, test, vi } from "vitest";

import { runComment } from "../../src/commands/comment.js";

type CommentAgentEnvelope<TData> = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type CommentData = {
  comment: {
    body: string;
    id: string;
    resolved: boolean;
  };
};

type CommentListData = {
  comments: Array<{
    id: string;
  }>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("comment --format=agent", () => {
  test("agent comment add", async () => {
    stubFetch(commentResponse("Review this flow."));
    const lines: string[] = [];

    await runComment(commentFlags({ format: "agent" }), "add", "CMT-001", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<CommentData>(stdout);
    expectNoHumanCommentLines(stdout);
    expect(envelope.data.comment.id).toBe("comment-1");
    expect(envelope.data.comment.body).toBe("Review this flow.");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec comment list"
    );
    expect(envelope.warnings).toEqual([]);
  });

  test("agent comment list", async () => {
    stubFetch({ comments: [commentPayload("Review this flow.")] });
    const lines: string[] = [];

    await runComment(commentFlags({ format: "agent" }), "list", "CMT-001", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<CommentListData>(stdout);
    expectNoHumanCommentLines(stdout);
    expect(envelope.data.comments.at(0)?.id).toBe("comment-1");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
  });

  test("agent comment edit", async () => {
    stubFetch(commentResponse("Addressed in spec."));
    const lines: string[] = [];

    await runComment(
      commentFlags({ body: "Addressed in spec.", format: "agent" }),
      "edit",
      "comment-1",
      (line) => lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<CommentData>(stdout);
    expectNoHumanCommentLines(stdout);
    expect(envelope.data.comment.id).toBe("comment-1");
    expect(envelope.data.comment.body).toBe("Addressed in spec.");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec comment list"
    );
  });

  test("agent comment resolve", async () => {
    stubFetch(commentResponse("Review this flow.", { resolved: true }));
    const lines: string[] = [];

    await runComment(
      commentFlags({ format: "agent" }),
      "resolve",
      "comment-1",
      (line) => lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<CommentData>(stdout);
    expectNoHumanCommentLines(stdout);
    expect(envelope.data.comment.id).toBe("comment-1");
    expect(envelope.data.comment.resolved).toBe(true);
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec comment list"
    );
  });

  test("agent comment delete", async () => {
    stubFetch(commentResponse("Review this flow.", { resolved: true }));
    const lines: string[] = [];

    await runComment(commentFlags({ format: "agent" }), "delete", "comment-1", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<CommentData>(stdout);
    expectNoHumanCommentLines(stdout);
    expect(stdout).not.toContain("Deleted true");
    expect(envelope.data.comment.id).toBe("comment-1");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec comment list"
    );
  });

  test("human comment lifecycle", async () => {
    stubFetch(commentResponse("Review this flow."));
    const addLines: string[] = [];
    await runComment(commentFlags(), "add", "CMT-001", (line) => addLines.push(line));
    expect(addLines).toContain("Comment comment-1");
    expect(addLines).toContain("Target usecase-1");
    expect(addLines).toContain("Author user-1");
    expect(addLines).toContain("Resolved false");
    expect(addLines).toContain("Body Review this flow.");

    stubFetch({ comments: [commentPayload("Review this flow.")] });
    const listLines: string[] = [];
    await runComment(commentFlags(), "list", "CMT-001", (line) => listLines.push(line));
    expect(listLines).toContain("Comments 1");
    expect(listLines).toContain("Comment comment-1");

    stubFetch(commentResponse("Review this flow.", { resolved: true }));
    const deleteLines: string[] = [];
    await runComment(commentFlags(), "delete", "comment-1", (line) =>
      deleteLines.push(line)
    );
    expect(deleteLines).toContain("Comment comment-1");
    expect(deleteLines).toContain("Deleted true");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = input.toString();
      return Promise.resolve(
        jsonResponse(url.endsWith("/sync/pull") ? syncPull() : body)
      );
    })
  );
}

function jsonResponse(body: unknown): Response {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response;
}

function syncPull() {
  return {
    cursor: "cursor-1",
    files: []
  };
}

function commentFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    body: "Review this flow.",
    "project-id": "project-1",
    "session-cookie": "session-token",
    ...overrides
  };
}

function commentResponse(
  body: string,
  overrides: Partial<ReturnType<typeof commentPayload>> = {}
) {
  return {
    comment: commentPayload(body, overrides),
    suggested_next_actions: [
      {
        command: "vspec comment list CMT-001",
        reason: "Review open comments for this use case."
      },
      {
        command: "vspec usecase show CMT-001",
        reason: "Open the commented use case."
      }
    ]
  };
}

function commentPayload(
  body: string,
  overrides: Partial<{
    resolved: boolean;
    resolved_at: null | string;
    updated_at: null | string;
  }> = {}
) {
  return {
    author_id: "user-1",
    body,
    created_at: "2026-05-22T00:00:00.000Z",
    id: "comment-1",
    resolved: overrides.resolved ?? false,
    resolved_at: overrides.resolved_at ?? null,
    target_id: "usecase-1",
    target_type: "USECASE",
    updated_at: overrides.updated_at ?? null
  };
}

function expectAgentEnvelope<TData>(stdout: string): CommentAgentEnvelope<TData> {
  const envelope = JSON.parse(stdout) as unknown as CommentAgentEnvelope<TData>;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function defaultContext(): CommentAgentEnvelope<unknown>["context"] {
  return {
    branch: null,
    project_key: null,
    revision: null,
    session_id: null
  };
}

function expectNoHumanCommentLines(stdout: string): void {
  expect(stdout).not.toContain("Comment ");
  expect(stdout).not.toContain("Target ");
  expect(stdout).not.toContain("Author ");
  expect(stdout).not.toContain("Resolved ");
  expect(stdout).not.toContain("Resolved at ");
  expect(stdout).not.toContain("Updated at ");
  expect(stdout).not.toContain("Body ");
  expect(stdout).not.toContain("Comments ");
}
