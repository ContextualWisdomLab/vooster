import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredLock, StoredUseCase } from "../../../src/domain/entities/index.js";
import { sendLockResult } from "../../../src/http/lock-results.js";

describe("lock result responses", () => {
  test("serializes created locks with renewal and unlock guidance", () => {
    const withId = reply();
    sendLockResult(withId.fastifyReply, {
      lock: lock(),
      status: "CREATED",
      usecase: usecase()
    });

    expect(withId.statusCode).toBe(201);
    expect(withId.body).toMatchObject({
      suggested_next_actions: [
        { command: "vspec lock renew lock-1" },
        { command: "vspec lock release lock-1" }
      ]
    });

    const withoutId = reply();
    sendLockResult(withoutId.fastifyReply, {
      lock: lock({ id: undefined }),
      status: "CREATED",
      usecase: usecase()
    });

    const withoutIdBody = withoutId.body as {
      suggested_next_actions: Array<{ command: string }>;
    };
    expect(withoutIdBody.suggested_next_actions[0]).toMatchObject({
      command: "vspec lock renew usecase-1"
    });
  });

  test("serializes renewed locks", () => {
    const captured = reply();
    const renewedLock = lock({ expires_at: "2026-05-23T12:00:00Z" });

    sendLockResult(captured.fastifyReply, {
      lock: renewedLock,
      status: "RENEWED",
      usecase: usecase()
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toEqual({ lock: renewedLock });
  });

  test("serializes released locks", () => {
    const captured = reply();
    const releasedLock = lock({ expires_at: "2026-05-23T12:00:00Z" });

    sendLockResult(captured.fastifyReply, {
      lock: releasedLock,
      status: "RELEASED",
      usecase: usecase()
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toEqual({ lock: releasedLock });
  });

  test("serializes active lock conflicts", () => {
    const cases = [
      {
        expectedStatus: 409,
        resultStatus: "COMPETING_LOCK" as const,
        title: "Competing lock exists"
      },
      {
        expectedStatus: 409,
        resultStatus: "EXPIRED_LOCK" as const,
        title: "Expired lock cannot be renewed"
      },
      {
        expectedStatus: 403,
        resultStatus: "FOREIGN_LOCK" as const,
        title: "Caller does not own this lock"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendLockResult(captured.fastifyReply, {
        lock: lock(),
        status: item.resultStatus,
        usecase: usecase()
      });

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({
        expires_at: "2026-05-23T11:00:00Z",
        title: item.title
      });
    }
  });

  test("serializes simple lock failures", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 404,
        result: { status: "LOCK_NOT_FOUND" as const },
        title: "Lock not found"
      },
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendLockResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
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

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    acquired_at: "2026-05-23T10:00:00Z",
    auto_release: true,
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-2",
    held_by_user_id: "user-2",
    holder: "session-2",
    id: "lock-1",
    lock_type: "HARD",
    mode: "HARD",
    reason: "Edit use case",
    target_id: "usecase-1",
    target_type: "USECASE",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function usecase(): StoredUseCase {
  return {
    id: "usecase-1",
    key: "PAY-001",
    title: "Place an order"
  } as StoredUseCase;
}
