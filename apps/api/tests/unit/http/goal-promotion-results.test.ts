import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredGoal,
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { sendGoalPromotionResult } from "../../../src/http/goal-promotion-results.js";

describe("goal promotion result responses", () => {
  test("serializes lookup and access failures", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 404,
        result: { status: "GOAL_NOT_FOUND" as const },
        title: "Goal not found"
      },
      {
        expectedStatus: 404,
        result: { status: "PROJECT_NOT_FOUND" as const },
        title: "Project not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendGoalPromotionResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes already-promoted and rejected failures", () => {
    const already = reply();
    sendGoalPromotionResult(already.fastifyReply, {
      existingUseCaseKey: "PAY-001",
      status: "ALREADY_PROMOTED"
    });

    expect(already.statusCode).toBe(409);
    expect(already.body).toMatchObject({
      existing_usecase_key: "PAY-001",
      title: "Goal is already promoted"
    });

    const rejected = reply();
    sendGoalPromotionResult(rejected.fastifyReply, {
      goalId: "goal-1",
      status: "REJECTED_GOAL"
    });

    expect(rejected.statusCode).toBe(422);
    expect(rejected.body).toMatchObject({
      suggested_next_actions: [
        { command: "vspec goal edit goal-1 --status in-design" }
      ],
      title: "Rejected goal cannot be promoted"
    });
  });

  test("serializes promotion write failures", () => {
    const captured = reply();
    sendGoalPromotionResult(captured.fastifyReply, {
      goalId: "goal-1",
      status: "PROMOTION_FAILED"
    });

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({
      exit_code: 5,
      suggested_next_actions: [{ command: "vspec goal promote goal-1" }],
      title: "Promotion failed"
    });
  });

  test("serializes promoted payloads with optional title warnings", () => {
    const promoted = reply();
    sendGoalPromotionResult(promoted.fastifyReply, {
      goal: goal(),
      revision: revision(),
      status: "PROMOTED",
      usecase: usecase()
    });

    expect(promoted.statusCode).toBe(201);
    expect(promoted.body).toMatchObject({
      goal: { id: "goal-1" },
      revision: { id: "revision-1" },
      suggested_next_actions: [
        { command: "vspec usecase add-stakeholder" },
        { command: "vspec scenario add PAY-001 --type main-success" }
      ],
      usecase: { key: "PAY-001" }
    });
    expect("warnings" in (promoted.body as Record<string, unknown>)).toBe(false);

    const warned = reply();
    sendGoalPromotionResult(warned.fastifyReply, {
      goal: goal(),
      revision: revision(),
      status: "PROMOTED",
      titleWarning: { field: "title", message: "Use a verb phrase." },
      usecase: usecase()
    });

    expect(warned.body).toMatchObject({
      suggested_next_actions: [
        { command: "vspec usecase add-stakeholder" },
        { command: "vspec scenario add PAY-001 --type main-success" },
        { command: "vspec usecase set PAY-001 --field title" }
      ],
      warnings: [{ field: "title", message: "Use a verb phrase." }]
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

function goal(): StoredGoal {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Place an order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: "usecase-1",
    priority: "P1",
    project_id: "project-1",
    status: "PROMOTED"
  };
}

function usecase(): StoredUseCase {
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
    scope: "pay",
    status: "DRAFT",
    title: "Place an order"
  };
}

function revision(): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    snapshot: usecase(),
    version_number: 1
  };
}
