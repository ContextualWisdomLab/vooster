import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredActor,
  StoredGoal,
  StoredRevision
} from "../../../src/domain/entities/index.js";
import {
  sendCreateGoalResult,
  sendListGoalsResult,
  sendPatchGoalResult
} from "../../../src/http/goal-results.js";

describe("goal result responses", () => {
  test("serializes create failures", () => {
    const unavailable = reply();
    sendCreateGoalResult(unavailable.fastifyReply, {
      actorId: "actor-missing",
      status: "ACTOR_UNAVAILABLE"
    });

    expect(unavailable.statusCode).toBe(422);
    expect(unavailable.body).toMatchObject({
      actor_id: "actor-missing",
      title: "Actor is not available"
    });

    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 409,
        result: { status: "WORKSPACE_ARCHIVED" as const },
        title: "Workspace has been archived"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCreateGoalResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes created goals", () => {
    const created = reply();
    sendCreateGoalResult(created.fastifyReply, {
      goal: goal(),
      revision: revision(),
      status: "CREATED"
    });

    const createdBody = created.body as Record<string, unknown>;
    expect(created.statusCode).toBe(201);
    expect(createdBody).toMatchObject({
      goal: { id: "goal-1" },
      recommended_next_command: "vspec goal list"
    });
    expect("warnings" in createdBody).toBe(false);

    const duplicate = reply();
    sendCreateGoalResult(duplicate.fastifyReply, {
      duplicateGoalId: "goal-duplicate",
      goal: goal(),
      revision: revision(),
      status: "CREATED"
    });

    expect(duplicate.body).toMatchObject({
      warnings: [
        {
          candidate_goal_id: "goal-duplicate",
          command: "vspec goal show goal-duplicate",
          type: "NEAR_DUPLICATE_GOAL"
        }
      ]
    });
  });

  test("serializes patch failures and success", () => {
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
        expectedStatus: 422,
        result: { status: "ILLEGAL_STATUS_TRANSITION" as const },
        title: "Illegal status transition"
      },
      {
        expectedStatus: 422,
        result: { status: "PROMOTED_REJECT_REQUIRES_ARCHIVE" as const },
        title: "Use case must be archived before rejecting this goal"
      },
      {
        expectedStatus: 409,
        result: { status: "WORKSPACE_ARCHIVED" as const },
        title: "Workspace has been archived"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendPatchGoalResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }

    const patched = reply();
    sendPatchGoalResult(patched.fastifyReply, {
      goal: goal({ status: "IN_DESIGN" }),
      revision: revision(),
      status: "PATCHED"
    });

    expect(patched.statusCode).toBeUndefined();
    expect(patched.body).toMatchObject({
      goal: { status: "IN_DESIGN" },
      revision: { id: "revision-1" }
    });
  });

  test("serializes listed goals and list access failures", () => {
    const listed = reply();
    sendListGoalsResult(listed.fastifyReply, {
      actors: [{ actor: actor(), goals: [goal()] }],
      status: "LISTED"
    });

    expect(listed.statusCode).toBeUndefined();
    expect(listed.body).toMatchObject({
      actors: [{ actor: { id: "actor-1" }, goals: [{ id: "goal-1" }] }]
    });

    const forbidden = reply();
    sendListGoalsResult(forbidden.fastifyReply, { status: "FORBIDDEN" });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).toMatchObject({
      title: "Contact the workspace owner for access"
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

function actor(): StoredActor {
  return { id: "actor-1" } as StoredActor;
}

function goal(overrides: Partial<StoredGoal> = {}): StoredGoal {
  return {
    id: "goal-1",
    status: "IDENTIFIED",
    ...overrides
  } as StoredGoal;
}

function revision(): StoredRevision {
  return { id: "revision-1" } as StoredRevision;
}
