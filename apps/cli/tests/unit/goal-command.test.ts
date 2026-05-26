import { afterEach, describe, expect, test, vi } from "vitest";

import { runGoal } from "../../src/commands/goal.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("goal command", () => {
  test("shows a goal from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            goal: goalBody({ description: "Submit an order" }),
            recommended_next_command: "vspec goal promote goal-1",
            revision: {
              version_number: 2
            }
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runGoal(
      {
        "api-url": "https://api.example.test",
        "session-cookie": "session-token"
      },
      "show",
      "goal-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toContain("Goal Submit an order");
  });

  test("rejects a goal through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            goal: goalBody({
              description: "Submit an order",
              status: "REJECTED"
            }),
            revision: {
              version_number: 3
            }
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runGoal(
      {
        "api-url": "https://api.example.test",
        "session-cookie": "session-token"
      },
      "reject",
      "goal-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toContain("Status REJECTED P1");
  });
});

function goalBody(
  overrides: Partial<{
    description: string;
    status: "IDENTIFIED" | "IN_DESIGN" | "PROMOTED" | "REJECTED";
  }> = {}
) {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Submit an order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: null,
    priority: "P1",
    project_id: "project-1",
    status: "IDENTIFIED",
    ...overrides
  };
}
