import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StepEditingResult } from "../../../src/application/step-editing.js";
import type {
  StoredLock,
  StoredRevision,
  StoredStep,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { sendStepEditingResult } from "../../../src/http/step-results.js";

describe("step editing result responses", () => {
  test("serializes simple step editing failures", () => {
    const cases: Array<{
      expectedStatus: number;
      result: StepEditingResult;
      title: string;
    }> = [
      {
        expectedStatus: 404,
        result: { status: "STEP_NOT_FOUND" },
        title: "Step not found"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 400,
        result: { status: "EMPTY_ACTION" },
        title: "Step action is required"
      },
      {
        expectedStatus: 400,
        result: { status: "NO_CHANGES" },
        title: "No step changes supplied"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendStepEditingResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes stale base and passive action problems", () => {
    const stale = reply();
    sendStepEditingResult(stale.fastifyReply, {
      baseRevision: "revision-1",
      currentRevision: "revision-2",
      status: "STALE_BASE",
      usecase: usecase()
    });

    expect(stale.statusCode).toBe(409);
    expect(stale.body).toMatchObject({
      current_revision_id: "revision-2",
      revision_diff: {
        base_revision: "revision-1",
        current_revision: "revision-2"
      }
    });

    const passive = reply();
    sendStepEditingResult(passive.fastifyReply, {
      action: "Order is paid.",
      status: "PASSIVE_ACTION"
    });

    expect(passive.statusCode).toBe(422);
    expect(passive.body).toMatchObject({
      suggested_action: "Paid the order.",
      suggested_next_actions: [{ command: "vspec step edit --force" }],
      title: "Step action uses passive voice"
    });
  });

  test("serializes lock conflicts", () => {
    const hard = reply();
    sendStepEditingResult(hard.fastifyReply, {
      lock: lock({ mode: "HARD" }),
      usecase: usecase(),
      status: "HARD_LOCKED"
    });

    expect(hard.statusCode).toBe(409);
    expect(hard.body).toMatchObject({
      suggested_next_actions: [{ command: "vspec who PAY-001" }],
      title: "Use case has a hard lock"
    });

    const semantic = reply();
    sendStepEditingResult(semantic.fastifyReply, {
      lock: lock({ mode: "SEMANTIC" }),
      usecase: usecase(),
      status: "SEMANTIC_LOCKED"
    });

    expect(semantic.statusCode).toBe(409);
    expect(semantic.body).toMatchObject({
      suggested_next_actions: [{ command: "vspec who PAY-001" }],
      title: "Use case has a semantic lock"
    });
  });

  test("serializes updated steps", () => {
    const captured = reply();
    const updatedStep = step();
    const savedRevision = revision();

    sendStepEditingResult(captured.fastifyReply, {
      affectedSessions: ["session-1"],
      revision: savedRevision,
      status: "UPDATED",
      step: updatedStep
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toEqual({
      affected_sessions: ["session-1"],
      revision: savedRevision,
      step: updatedStep
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

function revision(): StoredRevision {
  return {
    change_summary: "Edited step",
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-2",
    severity: "BREAKING",
    snapshot: usecase(),
    version_number: 2
  };
}

function step(): StoredStep {
  return {
    action: "Pays the order.",
    actor_id: "actor-1",
    id: "step-1",
    implements: [],
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-1",
    step_number: 1
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
