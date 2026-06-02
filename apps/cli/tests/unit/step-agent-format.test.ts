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
  format_version: 1;
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

    await runStep(stepFlags({ format: "agent" }), "add", "scenario-1", (line) =>
      lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.step.id).toBe("step-1");
    expect(envelope.data.step.action).toBe("Places an order.");
    expect(envelope.data.scenario_steps?.at(0)?.step_number).toBe(1);
    expect(envelope.context.revision).toBe("revision-1");
  });

  test("agent step edit", async () => {
    stubFetch(editStepBody());
    const lines: string[] = [];

    await runStep(
      stepFlags({
        "base-revision": "revision-1",
        format: "agent"
      }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.step.id).toBe("step-1");
    expect(envelope.data.step.action).toBe("Reviews the order.");
    expect(envelope.data.affected_sessions).toEqual(["session-1"]);
    expect(envelope.context.revision).toBeNull();
  });

  test("step edit sends actor changes", async () => {
    const requests: Array<{ body: unknown; url: string }> = [];
    stubFetch(editStepBody(), requests);
    const lines: string[] = [];

    await runStep(
      stepFlags({
        action: undefined,
        actor: "Support Agent",
        "base-revision": "revision-1"
      }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    expect(requests).toEqual([
      {
        body: {
          actor: "Support Agent",
          base_revision: "revision-1",
          force: false
        },
        url: "https://api.example.test/v1/steps/step-1"
      }
    ]);
  });

  test("step edit sends implementation links", async () => {
    const requests: Array<{ body: unknown; url: string }> = [];
    stubFetch(editStepBody(), requests);
    const lines: string[] = [];

    await runStep(
      stepFlags({
        "base-revision": "revision-1",
        implements: "tests/UC-013.feature:scenario_login,src/auth/login.ts"
      }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toMatchObject({
      implements: ["tests/UC-013.feature:scenario_login", "src/auth/login.ts"]
    });
  });

  test("step edit rejects malformed implementation links before fetch", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      runStep(
        stepFlags({
          "base-revision": "revision-1",
          implements: "bad ref"
        }),
        "edit",
        "step-1",
        () => undefined
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
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

    await runStep(
      stepFlags({ "base-revision": "revision-1" }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    expect(lines).toContain("Step step-1");
    expect(lines).toContain("Action Reviews the order.");
    expect(lines).toContain("Affected sessions session-1");
  });
});

function stubFetch(
  body: unknown,
  requests: Array<{ body: unknown; url: string }> = []
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit | undefined) => {
      requests.push({
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as unknown)
            : init?.body,
        url
      });
      return Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(body),
        ok: true
      } as Response);
    })
  );
}

function stepFlags(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
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
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
