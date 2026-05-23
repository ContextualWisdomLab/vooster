import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredLock,
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { sendChangePreviewResult } from "../../../src/http/change-preview-results.js";
import { previews } from "../../../src/http/change-preview-support.js";
import type { SignupState } from "../../../src/http/signup-types.js";

describe("change preview result responses", () => {
  test("serializes simple failure statuses", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      },
      {
        expectedStatus: 403,
        result: { status: "WRITE_FORBIDDEN" as const },
        title: "Write access required"
      },
      {
        expectedStatus: 400,
        result: { status: "PATCH_TARGET_MISMATCH" as const },
        title: "Patch targets a different use case"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendChangePreviewResult(captured.fastifyReply, signupState(), item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes hard lock and stale base failures", () => {
    const hardLocked = reply();
    sendChangePreviewResult(hardLocked.fastifyReply, signupState(), {
      lock: lock(),
      status: "HARD_LOCKED",
      usecase: usecase()
    });

    expect(hardLocked.statusCode).toBe(409);
    expect(hardLocked.body).toMatchObject({
      holding_session: "session-2",
      title: "Use case has a HARD lock"
    });

    const stale = reply();
    sendChangePreviewResult(stale.fastifyReply, signupState(), {
      currentRevision: revision({ severity: "BREAKING" }),
      status: "STALE_BASE",
      usecase: usecase()
    });

    expect(stale.statusCode).toBe(409);
    expect(stale.body).toMatchObject({
      current_revision: "revision-current",
      impact: { affected_sessions: [], severity: "BREAKING" },
      suggested_next_actions: [
        { command: "vspec usecase show PAY-001 --format=agent" },
        { command: "vspec change propose PAY-001" }
      ],
      title: "Stale base revision"
    });
  });

  test("serializes successful previews and stores them in state", () => {
    const state = signupState();
    const captured = reply();
    const preview = previewResult();

    sendChangePreviewResult(captured.fastifyReply, state, {
      affectedSessions: [affectedSession()],
      preview,
      status: "PREVIEWED",
      suggestedNextActions: [
        { command: "vspec change commit --preview-id preview-1", reason: "Review." }
      ],
      warnings: [
        {
          message: "NON_BREAKING changes require explicit human commit.",
          type: "AUTO_COMMIT_REFUSED"
        }
      ]
    });

    expect(captured.statusCode).toBe(201);
    expect(captured.body).toMatchObject({
      impact: {
        affected_sessions: [{ id: "session-1", pinned_usecase_keys: ["PAY-001"] }],
        severity: "NON_BREAKING"
      },
      preview_id: "preview-1",
      warnings: [{ type: "AUTO_COMMIT_REFUSED" }]
    });
    expect(previews(state).get("preview-1")).toEqual(preview);
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

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };
}

function usecase(): StoredUseCase {
  return {
    current_revision_id: "revision-current",
    id: "usecase-1",
    key: "PAY-001",
    title: "Place an order"
  } as StoredUseCase;
}

function lock(): StoredLock {
  return {
    held_by_session_id: "session-2",
    holder: "session-2",
    mode: "HARD"
  } as StoredLock;
}

function previewResult() {
  return {
    base_revision: "revision-current",
    diff: [
      {
        after: "Place an order quickly",
        before: "Place an order",
        entity_id: "usecase-1",
        entity_type: "USECASE" as const,
        path: "title" as const,
        severity: "NON_BREAKING" as const
      }
    ],
    expires_at: "2026-05-23T11:15:00Z",
    id: "preview-1",
    severity: "NON_BREAKING" as const,
    usecase_id: "usecase-1"
  };
}

function affectedSession() {
  return {
    agent_type: "CURSOR" as const,
    id: "session-1",
    owner: "user-1",
    pinned_usecase_keys: ["PAY-001"]
  };
}

function revision(overrides: Partial<StoredRevision> = {}): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-current",
    snapshot: usecase(),
    version_number: 2,
    ...overrides
  };
}
