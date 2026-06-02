import { afterEach, describe, expect, test, vi } from "vitest";

import { runActor } from "../../src/commands/actor.js";
import { runGoal } from "../../src/commands/goal.js";
import { runStakeholder } from "../../src/commands/stakeholder.js";
import { runUsecase } from "../../src/commands/usecase.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("--format=agent write-path envelopes", () => {
  test("agent actor create", async () => {
    stubFetch({
      actor: {
        aliases: [],
        archived_at: null,
        description: "",
        id: "actor-1",
        is_human: true,
        name: "Customer",
        project_id: "project-1",
        type: "PRIMARY"
      },
      recommended_next_command: "vspec stakeholder create",
      revision: { version_number: 1 }
    });
    const lines: string[] = [];

    await runActor(
      baseFlags({ name: "Customer", type: "PRIMARY" }),
      "create",
      undefined,
      (line) => lines.push(line)
    );

    expectAgentEnvelope(lines, "actor");
  });

  test("agent stakeholder create", async () => {
    stubFetch({
      recommended_next_command: "vspec usecase add-stakeholder",
      revision: { version_number: 1 },
      stakeholder: {
        archived_at: null,
        description: "",
        id: "stakeholder-1",
        name: "Sponsor",
        project_id: "project-1",
        type: "INTERNAL"
      }
    });
    const lines: string[] = [];

    await runStakeholder(
      baseFlags({ name: "Sponsor", type: "INTERNAL" }),
      "create",
      undefined,
      (line) => lines.push(line)
    );

    expectAgentEnvelope(lines, "stakeholder");
  });

  test("agent goal create", async () => {
    stubFetch({
      goal: goalBody({ description: "Places an order" }),
      recommended_next_command: "vspec goal list",
      revision: { version_number: 1 }
    });
    const lines: string[] = [];

    await runGoal(
      baseFlags({
        "actor-id": "actor-1",
        description: "Places an order",
        level: "USER_GOAL",
        priority: "P1"
      }),
      "create",
      undefined,
      (line) => lines.push(line)
    );

    expectAgentEnvelope(lines, "goal");
  });

  test("agent goal list", async () => {
    stubFetch({
      actors: [
        {
          actor: {
            aliases: [],
            archived_at: null,
            description: "",
            id: "actor-1",
            is_human: true,
            name: "Customer",
            project_id: "project-1",
            type: "PRIMARY"
          },
          goals: [goalBody({ description: "Places an order" })]
        }
      ]
    });
    const lines: string[] = [];

    await runGoal(baseFlags(), "list", undefined, (line) => lines.push(line));

    expectAgentEnvelope(lines, "actors");
  });

  test("agent goal promote", async () => {
    stubFetch({
      goal: goalBody({ description: "Places an order", status: "PROMOTED" }),
      revision: { version_number: 1 },
      suggested_next_actions: [{ command: "vspec scenario add", reason: "Write." }],
      usecase: {
        format: "BRIEF",
        id: "usecase-1",
        key: "AGT-001",
        title: "Places an order"
      }
    });
    const lines: string[] = [];

    await runGoal(baseFlags(), "promote", "goal-1", (line) => lines.push(line));

    expectAgentEnvelope(lines, "usecase");
  });

  test("agent usecase create", async () => {
    stubFetch({
      revision: { version_number: 1 },
      suggested_next_actions: [{ command: "vspec scenario add", reason: "Write." }],
      usecase: { id: "usecase-1", key: "AGT-001", title: "Places an order" }
    });
    const lines: string[] = [];

    await runUsecase(
      baseFlags({ "primary-actor": "Customer", title: "Places an order" }),
      "create",
      undefined,
      (line) => lines.push(line)
    );

    expectAgentEnvelope(lines, "usecase");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = input.toString();
      return Promise.resolve(
        jsonResponse(url.endsWith("/sync/pull") ? syncPull() : body)
      );
    })
  );
}

function jsonResponse(body: unknown): Response {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response;
}

function syncPull() {
  return {
    cursor: "cursor-1",
    files: []
  };
}

function baseFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    format: "agent",
    "project-id": "project-1",
    "session-cookie": "session-token",
    ...overrides
  };
}

function goalBody(
  overrides: Partial<{
    description: string;
    status: "IDENTIFIED" | "IN_DESIGN" | "PROMOTED" | "REJECTED";
  }> = {}
) {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Places an order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: null,
    priority: "P1",
    project_id: "project-1",
    status: "IDENTIFIED",
    ...overrides
  };
}

function expectAgentEnvelope(lines: string[], dataKey: string): void {
  const envelope = JSON.parse(lines.join("\n")) as Record<string, unknown>;

  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(envelope.data).toHaveProperty(dataKey);
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
}
