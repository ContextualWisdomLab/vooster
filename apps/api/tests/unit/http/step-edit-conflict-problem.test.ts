import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StepEditingResult } from "../../../src/application/step-editing.js";
import type { StoredLock, StoredUseCase } from "../../../src/domain/entities/index.js";
import { sendStepEditingResult } from "../../../src/http/step-results.js";

describe("step edit conflict problem details", () => {
  test("all conflict branches name the cause and include next actions", () => {
    const cases: Array<{
      expectedTitle: string;
      result: StepEditingResult;
    }> = [
      {
        expectedTitle: "Base revision is stale",
        result: {
          baseRevision: "revision-1",
          currentRevision: "revision-2",
          status: "STALE_BASE",
          usecase: usecase()
        }
      },
      {
        expectedTitle: "Use case has a hard lock",
        result: {
          lock: lock({ mode: "HARD" }),
          status: "HARD_LOCKED",
          usecase: usecase()
        }
      },
      {
        expectedTitle: "Use case has a semantic lock",
        result: {
          lock: lock({ mode: "SEMANTIC" }),
          status: "SEMANTIC_LOCKED",
          usecase: usecase()
        }
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendStepEditingResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(409);
      expect(captured.body).toMatchObject({
        status: 409,
        title: item.expectedTitle
      });
      expect(suggestedNextActions(captured.body).length).toBeGreaterThan(0);
    }
  });
});

function suggestedNextActions(body: unknown): unknown[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const actions = (body as { suggested_next_actions?: unknown }).suggested_next_actions;
  return Array.isArray(actions) ? actions : [];
}

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
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-2",
    held_by_user_id: "user-2",
    holder: "session-2",
    id: "lock-1",
    mode: "HARD",
    reason: "Edit use case",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function usecase(): StoredUseCase {
  return {
    current_revision_id: "revision-2",
    id: "usecase-1",
    key: "PAY-001",
    project_id: "project-1",
    title: "Place an order"
  } as StoredUseCase;
}
