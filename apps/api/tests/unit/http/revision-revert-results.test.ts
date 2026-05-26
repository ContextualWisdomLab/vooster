import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredLock,
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { sendRevisionRevertResult } from "../../../src/http/revision-revert-results.js";

describe("revision revert result responses", () => {
  test("serializes simple revert failures", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "CURRENT_REVISION_NOT_FOUND" as const },
        title: "Revision not found"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Not authorized to revert use case"
      },
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendRevisionRevertResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes lock, missing revision, breaking, and write failures", () => {
    const hardLocked = reply();
    sendRevisionRevertResult(hardLocked.fastifyReply, {
      lock: lock(),
      status: "HARD_LOCKED",
      usecase: usecase()
    });

    expect(hardLocked.statusCode).toBe(409);
    expect(hardLocked.body).toMatchObject({
      held_by_user_id: "user-2",
      holding_session: "session-2",
      suggested_next_actions: [{ command: "vspec who PAY-001" }],
      title: "Use case is HARD locked"
    });

    const missing = reply();
    sendRevisionRevertResult(missing.fastifyReply, {
      revisionId: "revision-missing",
      status: "TARGET_REVISION_NOT_FOUND",
      usecase: usecase()
    });

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({
      missing_revision: "revision-missing",
      suggested_next_actions: [{ command: "vspec history PAY-001" }],
      title: "Revision not found"
    });

    const breaking = reply();
    sendRevisionRevertResult(breaking.fastifyReply, {
      affectedSessions: ["session-1"],
      currentRevision: revision({ id: "revision-current" }),
      status: "BREAKING_REVERT",
      targetRevisionId: "revision-1",
      usecase: usecase()
    });

    expect(breaking.statusCode).toBe(409);
    expect(breaking.body).toMatchObject({
      affected_sessions: ["session-1"],
      breaking_changes: [{ revision: "revision-current", severity: "BREAKING" }],
      suggested_next_actions: [
        { command: 'vspec revert PAY-001 --to revision-1 --force --summary "<reason>"' }
      ],
      title: "Revert would reintroduce breaking changes"
    });

    const writeFailed = reply();
    sendRevisionRevertResult(writeFailed.fastifyReply, {
      status: "WRITE_FAILED",
      targetRevisionId: "revision-1",
      usecase: usecase()
    });

    expect(writeFailed.statusCode).toBe(500);
    expect(writeFailed.body).toMatchObject({
      exit_code: 5,
      suggested_next_actions: [
        { command: "vspec revert PAY-001 --to revision-1 --retry" }
      ],
      title: "Revert write failed"
    });
  });

  test("serializes reverted payloads with optional warnings", () => {
    const clean = reply();
    sendRevisionRevertResult(clean.fastifyReply, {
      impact: {
        affected_branches: [],
        affected_sessions: [],
        severity: "NON_BREAKING"
      },
      revision: revision(),
      status: "REVERTED",
      suggestedNextActions: [
        { command: "vspec usecase show PAY-001", reason: "Review." }
      ],
      usecase: usecase()
    });

    expect(clean.statusCode).toBe(201);
    expect(clean.body).toEqual({
      impact: {
        affected_branches: [],
        affected_sessions: [],
        severity: "NON_BREAKING"
      },
      revision: revision(),
      suggested_next_actions: [
        { command: "vspec usecase show PAY-001", reason: "Review." }
      ],
      usecase: usecase()
    });

    const warned = reply();
    sendRevisionRevertResult(warned.fastifyReply, {
      impact: { affected_branches: [], affected_sessions: [], severity: "BREAKING" },
      revision: revision({ severity: "BREAKING" }),
      status: "REVERTED",
      suggestedNextActions: [],
      usecase: usecase(),
      warnings: [{ message: "Breaking revert was forced.", type: "FORCED_REVERT" }]
    });

    expect(warned.body).toMatchObject({
      warnings: [{ message: "Breaking revert was forced.", type: "FORCED_REVERT" }]
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

function lock(): StoredLock {
  return {
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-2",
    held_by_user_id: "user-2"
  } as StoredLock;
}

function revision(overrides: Partial<StoredRevision> = {}): StoredRevision {
  return {
    change_summary: "Revert to revision-1",
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-2",
    parent_revision_id: "revision-1",
    severity: "NON_BREAKING",
    snapshot: usecase(),
    version_number: 2,
    ...overrides
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-2",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Payments",
    status: "DRAFT",
    title: "Reviews a refund"
  };
}
