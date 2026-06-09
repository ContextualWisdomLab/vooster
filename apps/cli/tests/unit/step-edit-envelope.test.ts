import { afterEach, describe, expect, test, vi } from "vitest";

import { runStep } from "../../src/commands/step.js";

type AgentEnvelope = {
  data: unknown;
  error?: {
    code: string;
    message: string;
  };
  status: "error" | "ok";
  suggested_next_actions: Array<{
    command: string;
    reason?: string;
  }>;
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

describe("step edit envelopes", () => {
  test("agent success carries a top-level ok status", async () => {
    stubFetch({ body: editStepBody(), ok: true, status: 200 });
    const lines: string[] = [];

    await runStep(
      stepFlags({ "base-revision": "revision-1", format: "agent" }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as AgentEnvelope;
    expect(envelope.status).toBe("ok");
    expect(envelope.data).toMatchObject({
      step: {
        id: "step-1"
      }
    });
  });

  test("agent error carries a classified status and next action", async () => {
    stubFetch({ body: staleBaseProblem(), ok: false, status: 409 });
    const lines: string[] = [];

    await runStep(
      stepFlags({ "base-revision": "revision-old", format: "agent" }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as AgentEnvelope;
    expect(envelope.status).toBe("error");
    expect(envelope.error).toMatchObject({
      code: "CONFLICT",
      message: "Base revision is stale"
    });
    expect(envelope.suggested_next_actions).toEqual([
      {
        command: "vspec usecase show PAY-001",
        reason: "Inspect the current use case before retrying the step edit."
      }
    ]);
    expect(process.exitCode).toBe(1);
  });

  test("human error prints the cause and next action without a raw ApiError", async () => {
    stubFetch({ body: staleBaseProblem(), ok: false, status: 409 });
    const lines: string[] = [];

    await runStep(
      stepFlags({ "base-revision": "revision-old" }),
      "edit",
      "step-1",
      (line) => lines.push(line)
    );

    expect(lines).toContain("Error: Base revision is stale");
    expect(lines).toContain(
      "  vspec usecase show PAY-001 - Inspect the current use case before retrying the step edit."
    );
    expect(lines.join("\n")).not.toContain("ApiError: API request failed");
    expect(process.exitCode).toBe(1);
  });
});

function stubFetch(input: { body: unknown; ok: boolean; status: number }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(input.body),
        ok: input.ok,
        status: input.status
      } as Response)
    )
  );
}

function stepFlags(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    action: "Reviews the order.",
    actor: "Customer",
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function editStepBody() {
  return {
    affected_sessions: ["session-1"],
    revision: {
      severity: "BREAKING",
      version_number: 2
    },
    step: {
      action: "Reviews the order.",
      id: "step-1"
    }
  };
}

function staleBaseProblem() {
  return {
    current_revision_id: "revision-2",
    revision_diff: {
      base_revision: "revision-old",
      current_revision: "revision-2"
    },
    status: 409,
    suggested_next_actions: [
      {
        command: "vspec usecase show PAY-001",
        reason: "Inspect the current use case before retrying the step edit."
      }
    ],
    title: "Base revision is stale",
    type: "https://vspec.dev/errors/bad-request"
  };
}
