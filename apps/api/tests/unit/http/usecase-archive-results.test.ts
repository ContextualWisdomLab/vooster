import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import {
  sendArchiveUseCaseResult,
  sendRestoreUseCaseResult
} from "../../../src/http/usecase-archive-results.js";

describe("use case archive result responses", () => {
  test("serializes archive lookup and access failures", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendArchiveUseCaseResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes archive conflicts and hard-delete guidance", () => {
    const hardDelete = reply();
    sendArchiveUseCaseResult(hardDelete.fastifyReply, {
      status: "HARD_DELETE_REQUESTED",
      usecase: usecase()
    });

    expect(hardDelete.statusCode).toBe(400);
    expect(hardDelete.body).toMatchObject({
      destructive_delete: true,
      suggested_next_actions: [{ command: "vspec usecase archive PAY-001" }],
      title: "Destructive deletion is post-MVP"
    });

    const already = reply();
    sendArchiveUseCaseResult(already.fastifyReply, {
      status: "ALREADY_ARCHIVED",
      usecase: usecase({ archived_at: "2026-05-23T00:00:00Z" })
    });

    expect(already.statusCode).toBe(409);
    expect(already.body).toMatchObject({
      archived_at: "2026-05-23T00:00:00Z",
      title: "Use case is already archived"
    });

    const hardLocked = reply();
    sendArchiveUseCaseResult(hardLocked.fastifyReply, {
      expiresAt: "2026-05-23T11:00:00Z",
      holdingSession: "session-2",
      lock: {} as never,
      status: "HARD_LOCKED"
    });

    expect(hardLocked.statusCode).toBe(409);
    expect(hardLocked.body).toMatchObject({
      expires_at: "2026-05-23T11:00:00Z",
      holding_session: "session-2",
      title: "Use case has an active HARD lock"
    });
  });

  test("serializes successful archive payloads", () => {
    const captured = reply();
    sendArchiveUseCaseResult(captured.fastifyReply, {
      activeLocksCount: 2,
      affectedSessions: [{ id: "session-1", pinned_revision: "revision-1" }],
      revision: revisionSummary(),
      status: "ARCHIVED",
      usecase: {
        archived_at: "2026-05-23T00:00:00Z",
        id: "usecase-1",
        key: "PAY-001"
      }
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toMatchObject({
      active_locks_count: 2,
      affected_sessions_count: 1,
      suggested_next_actions: [{ command: "vspec usecase restore PAY-001" }],
      usecase: { archived_at: "2026-05-23T00:00:00Z" }
    });
  });

  test("serializes restore failures and success", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 409,
        result: { status: "NOT_ARCHIVED" as const },
        title: "Use case is not archived"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendRestoreUseCaseResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }

    const restored = reply();
    sendRestoreUseCaseResult(restored.fastifyReply, {
      revision: revisionSummary(),
      status: "RESTORED",
      usecase: { archived_at: null, id: "usecase-1", key: "PAY-001" }
    });

    expect(restored.statusCode).toBeUndefined();
    expect(restored.body).toEqual({
      revision: revisionSummary(),
      usecase: { archived_at: null, id: "usecase-1", key: "PAY-001" }
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

function revisionSummary() {
  return { change_summary: "Archived use case PAY-001", id: "revision-2" };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order",
    ...overrides
  };
}
