import { describe, expect, test } from "vitest";
import {
  goalCreateRequestSchema,
  goalCreateResponseSchema,
  goalListQuerySchema,
  goalListResponseSchema,
  goalPatchResponseSchema,
  goalPromoteRequestSchema,
  goalPromotionResponseSchema,
  goalShowResponseSchema
} from "../src/index.js";

describe("goal contracts", () => {
  test("parse create, list, and promote requests", () => {
    expect(
      goalCreateRequestSchema.parse({
        actor_id: "actor-1",
        description: "Places an order",
        level: "USER_GOAL",
        priority: "P1"
      }).actor_id
    ).toBe("actor-1");
    expect(goalListQuerySchema.parse({ actor_id: "actor-1" })).toEqual({
      actor_id: "actor-1"
    });
    expect(goalPromoteRequestSchema.parse({})).toEqual({});
  });

  test("reject create requests without an actor reference", () => {
    expect(() =>
      goalCreateRequestSchema.parse({
        description: "Places an order",
        level: "USER_GOAL",
        priority: "P1"
      })
    ).toThrow();
  });

  test("parse goal response bodies", () => {
    const goal = goalBody();
    const actor = actorBody();

    expect(
      goalCreateResponseSchema.parse({
        goal,
        recommended_next_command: "vspec goal list",
        revision: { id: "revision-1", version_number: 1 }
      }).goal.id
    ).toBe("goal-1");
    expect(
      goalShowResponseSchema.parse({
        goal,
        recommended_next_command: "vspec goal list"
      }).recommended_next_command
    ).toBe("vspec goal list");
    expect(
      goalPatchResponseSchema.parse({
        goal: { ...goal, status: "REJECTED" },
        revision: { version_number: 2 }
      }).goal.status
    ).toBe("REJECTED");
    expect(
      goalListResponseSchema.parse({
        actors: [{ actor, goals: [goal] }]
      }).actors[0]?.goals[0]?.id
    ).toBe("goal-1");
    expect(
      goalPromotionResponseSchema.parse({
        goal: { ...goal, status: "PROMOTED" },
        revision: { version_number: 1 },
        suggested_next_actions: [{ command: "vspec scenario add", reason: "Write." }],
        usecase: { format: "BRIEF", key: "PAY-001", title: "Places an order" }
      }).usecase.key
    ).toBe("PAY-001");
  });
});

function goalBody() {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Places an order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: null,
    priority: "P1",
    project_id: "project-1",
    status: "IDENTIFIED"
  };
}

function actorBody() {
  return {
    aliases: [],
    archived_at: null,
    description: "",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY"
  };
}
