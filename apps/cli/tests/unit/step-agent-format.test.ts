import { afterEach, describe, expect, test, vi } from "vitest";

import { runStep } from "../../src/commands/step.js";

type StepAgentEnvelope = {
  affected_files?: unknown[];
  context: {
    revision: null | string;
  };
  data: {
    affected_sessions?: string[];
    revision: {
      id?: string;
      severity: string;
      version_number: number;
    };
    scenario_steps?: Array<{
      action: string;
      step_number: number;
    }>;
    step: {
      action: string;
      id: string;
      step_number?: number;
    };
  };
  dry_run?: boolean;
  format_version: 1 | 2;
  status?: "ok" | "error";
  suggested_next_actions: unknown[];
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("step --format=agent", () => {
  test("agent step add", async () => {
    stubFetch(addStepBody());
    const lines: string[] = [];

    await runStep(stepFlags({ format: "agent" }), "add", "scenario-1", (line) => lines.push(line));

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.step.id).toBe("step-1");
    expect(envelope.data.step.action).toBe("Places an order.");
    expect(envelope.data.scenario_steps?.at(0)?.step_number).toBe(1);
  });

  test("agent step edit", async () => {
    stubFetch(editStepBody());
    const lines: string[] = [];

    await runStep(stepFlags({
      "base-revision": "revision-1",
      format: "agent"
    }), "edit", "step-1", (line) => lines.push(line));

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.step.id).toBe("step-1");
    expect(envelope.data.step.action).toBe("Reviews the order.");
    expect(envelope.data.affected_sessions).toEqual(["session-1"]);
    expect(envelope.context.revision).toBeNull();
  });

  test("human step add", async () => {
    stubFetch(addStepBody());
    const lines: string[] = [];

    await runStep(stepFlags(), "add", "scenario-1", (line) => lines.push(line));

    expect(lines).toContain("Step step-1");
    expect(lines).toContain("1. Customer Places an order.");
    expect(lines).toContain("Revision id revision-1");
  });

  test("human step edit", async () => {
    stubFetch(editStepBody());
    const lines: string[] = [];

    await runStep(stepFlags({ "base-revision": "revision-1" }), "edit", "step-1", (line) => lines.push(line));

    expect(lines).toContain("Step step-1");
    expect(lines).toContain("Action Reviews the order.");
    expect(lines).toContain("Affected sessions session-1");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response)));
}

function stepFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    action: "Places an order.",
    actor: "Customer",
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function addStepBody() {
  return {
    revision: {
      id: "revision-1",
      severity: "MINOR",
      version_number: 4
    },
    scenario_steps: [
      {
        action: "Places an order.",
        step_number: 1
      }
    ],
    step: {
      action: "Places an order.",
      id: "step-1",
      step_number: 1
    }
  };
}

function editStepBody() {
  return {
    affected_sessions: ["session-1"],
    revision: {
      severity: "MINOR",
      version_number: 5
    },
    step: {
      action: "Reviews the order.",
      id: "step-1"
    }
  };
}

function expectAgentEnvelope(lines: string[]): StepAgentEnvelope {
  const envelope = JSON.parse(lines.join("\n")) as unknown as StepAgentEnvelope;
  expect([1, 2]).toContain(envelope.format_version);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
