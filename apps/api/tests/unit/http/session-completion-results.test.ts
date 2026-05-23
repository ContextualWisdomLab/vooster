import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredMergeRequest,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import { sendCompleteSessionResult } from "../../../src/http/session-completion-results.js";

describe("session completion result responses", () => {
  test("serializes lookup and access failures", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "SESSION_NOT_FOUND" as const },
        title: "Session not found"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCompleteSessionResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes inactive and failed completion guidance", () => {
    const inactive = reply();
    sendCompleteSessionResult(inactive.fastifyReply, {
      currentStatus: "COMPLETED",
      sessionId: "session-1",
      status: "SESSION_NOT_ACTIVE"
    });

    expect(inactive.statusCode).toBe(409);
    expect(inactive.body).toMatchObject({
      current_status: "COMPLETED",
      suggested_next_actions: [{ command: "vspec session show session-1" }],
      title: "Session is not active"
    });

    const failed = reply();
    sendCompleteSessionResult(failed.fastifyReply, {
      exitCode: 5,
      status: "COMPLETION_FAILED"
    });

    expect(failed.statusCode).toBe(500);
    expect(failed.body).toMatchObject({
      exit_code: 5,
      suggested_next_actions: [{ command: "vspec session complete --retry" }],
      title: "Session completion failed"
    });
  });

  test("serializes completed sessions without optional fields", () => {
    const captured = reply();
    sendCompleteSessionResult(captured.fastifyReply, {
      releasedLockIds: ["lock-1"],
      session: session(),
      status: "COMPLETED",
      suggestedNextActions: [{ command: "vspec session list", reason: "Review." }],
      warnings: []
    });

    const body = captured.body as Record<string, unknown>;

    expect(captured.statusCode).toBeUndefined();
    expect(body).toMatchObject({
      released_lock_ids: ["lock-1"],
      session: { id: "session-1" },
      session_file: { cleared: true, path: ".vspec/session.json" },
      suggested_next_actions: [{ command: "vspec session list" }]
    });
    expect("merge_request" in body).toBe(false);
    expect("warnings" in body).toBe(false);
  });

  test("serializes completed sessions with warnings and merge requests", () => {
    const captured = reply();
    sendCompleteSessionResult(captured.fastifyReply, {
      mergeRequest: mergeRequest(),
      releasedLockIds: [],
      session: session({ branch_id: "branch-source" }),
      status: "COMPLETED",
      suggestedNextActions: [
        { command: "vspec merge show merge-1", reason: "Review." }
      ],
      warnings: [
        {
          lock_id: "lock-1",
          message: "Lock was already released before completion.",
          type: "LOCK_RELEASE_FAILED"
        }
      ]
    });

    expect(captured.body).toMatchObject({
      merge_request: { id: "merge-1" },
      warnings: [{ lock_id: "lock-1", type: "LOCK_RELEASE_FAILED" }]
    });
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    branch_id: null,
    ended_at: "2026-05-23T11:00:00Z",
    id: "session-1",
    last_activity_at: "2026-05-23T11:00:00Z",
    project_id: "project-1",
    status: "COMPLETED",
    user_id: "user-1",
    ...overrides
  };
}

function mergeRequest(): StoredMergeRequest {
  return {
    conflicts: [],
    current_revision_id: "revision-current",
    id: "merge-1",
    impact: { affected_branches: [], affected_sessions: [], severity_by_entity: {} },
    source_branch_id: "branch-source",
    status: "OPEN",
    strategy: "SQUASH",
    target_branch_id: "branch-main"
  };
}
