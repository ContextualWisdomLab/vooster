import { afterEach, describe, expect, test, vi } from "vitest";

import { runUsecase } from "../../src/commands/usecase.js";

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

describe("usecase add-stakeholder envelopes", () => {
  test("agent duplicate error returns a structured envelope", async () => {
    stubFetch({ body: duplicateInterestProblem(), ok: false, status: 409 });
    const lines: string[] = [];

    await runUsecase(
      usecaseFlags({ format: "agent" }),
      "add-stakeholder",
      "usecase-1",
      (line) => lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as AgentEnvelope;
    expect(envelope.status).toBe("error");
    expect(envelope.data).toBeNull();
    expect(envelope.error).toMatchObject({
      code: "STAKEHOLDER_ALREADY_ATTACHED",
      message: "Stakeholder interest already exists"
    });
    expect(envelope.suggested_next_actions).toEqual([
      {
        command: "vspec usecase show usecase-1",
        reason: "Review the existing stakeholder interest before changing it."
      }
    ]);
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

function usecaseFlags(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    "api-url": "https://api.example.test",
    interest: "Revenue remains visible.",
    "session-cookie": "session-token",
    stakeholder: "Product Manager",
    ...overrides
  };
}

function duplicateInterestProblem() {
  return {
    code: "STAKEHOLDER_ALREADY_ATTACHED",
    existing_interest: "Revenue remains visible.",
    status: 409,
    suggested_next_actions: [
      {
        command: "vspec usecase show usecase-1",
        reason: "Review the existing stakeholder interest before changing it."
      }
    ],
    title: "Stakeholder interest already exists",
    type: "https://vspec.dev/errors/bad-request"
  };
}
