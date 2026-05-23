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
            goal: {
              description: "Submit an order",
              priority: "P1",
              status: "IDENTIFIED"
            },
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

    expect(fetchStub).toHaveBeenCalledWith("https://api.example.test/v1/goals/goal-1", {
      headers: {
        Cookie: "vspec_session=session-token"
      }
    });
    expect(lines).toContain("Goal Submit an order");
  });

  test("rejects a goal through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            goal: {
              description: "Submit an order",
              priority: "P1",
              status: "REJECTED"
            },
            recommended_next_command: "vspec goal list",
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

    expect(fetchStub).toHaveBeenCalledWith("https://api.example.test/v1/goals/goal-1", {
      body: JSON.stringify({ status: "REJECTED" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "vspec_session=session-token"
      },
      method: "PATCH"
    });
    expect(lines).toContain("Status REJECTED P1");
  });
});
