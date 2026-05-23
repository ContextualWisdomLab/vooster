import { describe, expect, test } from "vitest";
import type { StoredGoal } from "../../../src/domain/entities/index.js";
import {
  allowedStatusTransitions,
  canTransition,
  goalCreateResponse,
  goalIdFrom,
  goalRevision,
  nearDuplicateGoal,
  projectIdFrom
} from "../../../src/http/goal-support.js";

describe("goal support", () => {
  test("describes and enforces the allowed status transitions", () => {
    expect(allowedStatusTransitions).toEqual([
      "IDENTIFIED -> IN_DESIGN",
      "IN_DESIGN -> PROMOTED",
      "any -> REJECTED"
    ]);

    expect(canTransition("IDENTIFIED", "IDENTIFIED")).toBe(true);
    expect(canTransition("IDENTIFIED", "IN_DESIGN")).toBe(true);
    expect(canTransition("IN_DESIGN", "PROMOTED")).toBe(true);
    expect(canTransition("PROMOTED", "REJECTED")).toBe(true);
    expect(canTransition("IDENTIFIED", "PROMOTED")).toBe(false);
    expect(canTransition("REJECTED", "IN_DESIGN")).toBe(false);
  });

  test("creates a revision snapshot for the supplied goal version", () => {
    const goal = storedGoal({ id: "goal-1", description: "Review orders" });

    const revision = goalRevision(goal, 3);

    expect(revision).toMatchObject({
      entity_id: "goal-1",
      entity_type: "GOAL",
      snapshot: goal,
      version_number: 3
    });
    expect(revision.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(revision.snapshot).not.toBe(goal);
  });

  test("finds near duplicates by actor and normalized description", () => {
    const goals = [
      storedGoal({
        actor_id: "actor-1",
        description: "Reviews purchase orders!",
        id: "goal-1"
      }),
      storedGoal({
        actor_id: "actor-2",
        description: "Reviews purchase order",
        id: "goal-2"
      })
    ];

    expect(nearDuplicateGoal(goals, "actor-1", "Review purchase order")?.id).toBe(
      "goal-1"
    );
    expect(nearDuplicateGoal(goals, "actor-2", "Review purchase order")?.id).toBe(
      "goal-2"
    );
    expect(
      nearDuplicateGoal(goals, "actor-3", "Review purchase order")
    ).toBeUndefined();
  });

  test("adds a warning only when a duplicate goal exists", () => {
    const goal = storedGoal({ id: "goal-new" });
    const duplicate = storedGoal({ id: "goal-existing" });
    const revision = goalRevision(goal, 1);

    expect(goalCreateResponse(goal, revision, undefined)).toEqual({
      goal,
      recommended_next_command: "vspec goal list",
      revision
    });
    expect(goalCreateResponse(goal, revision, duplicate)).toMatchObject({
      warnings: [
        {
          candidate_goal_id: "goal-existing",
          command: "vspec goal show goal-existing",
          type: "NEAR_DUPLICATE_GOAL"
        }
      ]
    });
  });

  test("extracts route ids from valid params", () => {
    expect(projectIdFrom({ projectId: "project-1" })).toBe("project-1");
    expect(goalIdFrom({ goalId: "goal-1" })).toBe("goal-1");
  });

  test("rejects missing route ids", () => {
    expect(() => projectIdFrom({ projectId: "" })).toThrow();
    expect(() => goalIdFrom({})).toThrow();
  });
});

function storedGoal(overrides: Partial<StoredGoal> = {}): StoredGoal {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Review purchase order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: null,
    priority: "P1",
    project_id: "project-1",
    status: "IDENTIFIED",
    ...overrides
  };
}
