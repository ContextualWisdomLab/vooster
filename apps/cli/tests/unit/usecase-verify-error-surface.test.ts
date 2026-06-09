import { afterEach, describe, expect, test, vi } from "vitest";

import { runVerify } from "../../src/commands/verify.js";

type ErrorEnvelope = {
  error?: {
    code: string;
    message: string;
  };
  status: "error";
  suggested_next_actions: Array<{
    command: string;
    reason: string;
  }>;
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

describe("usecase verify error surface", () => {
  test("prints a self-teaching agent envelope when the use case key is missing", async () => {
    const fetchSpy = stubNotFound();
    const lines: string[] = [];

    await runVerify(flags({ format: "agent" }), undefined, (line) => lines.push(line));

    expect(fetchSpy).not.toHaveBeenCalled();
    const envelope = parseEnvelope(lines);
    expect(envelope.error?.code).toBe("BAD_REQUEST");
    expect(envelope.error?.message).toContain("Missing usecase-id");
    expect(envelope.suggested_next_actions.map((action) => action.command)).toEqual([
      "vspec usecase list",
      "vspec usecase verify <usecase-key>"
    ]);
    expect(lines.join("\n")).not.toContain("ApiError");
    expect(process.exitCode).toBe(1);
  });

  test("prints a self-teaching agent envelope when the use case key is unresolved", async () => {
    stubNotFound();
    const lines: string[] = [];

    await runVerify(flags({ format: "agent" }), "MISSING-001", (line) =>
      lines.push(line)
    );

    const envelope = parseEnvelope(lines);
    expect(envelope.error?.code).toBe("NOT_FOUND");
    expect(envelope.error?.message).toContain("MISSING-001");
    expect(envelope.suggested_next_actions.map((action) => action.command)).toEqual([
      "vspec usecase list",
      "vspec usecase verify <usecase-key>"
    ]);
    expect(lines.join("\n")).not.toContain("ApiError");
    expect(process.exitCode).toBe(1);
  });

  test("prints a structured JSON error for the keyless dogfood command", async () => {
    const lines: string[] = [];

    await runVerify(flags({ format: "json" }), undefined, (line) => lines.push(line));

    const envelope = parseEnvelope(lines);
    expect(envelope.error?.code).toBe("BAD_REQUEST");
    expect(envelope.error?.message).toContain("Missing usecase-id");
    expect(lines.join("\n")).not.toContain("Error:");
    expect(process.exitCode).toBe(1);
  });

  test.each([
    [undefined, "Missing usecase-id"],
    ["MISSING-001", "MISSING-001"]
  ] as const)("prints self-teaching human output for %s", async (usecaseId, text) => {
    stubNotFound();
    const lines: string[] = [];

    await runVerify(flags(), usecaseId, (line) => lines.push(line));

    const output = lines.join("\n");
    expect(output).toContain(`Error:`);
    expect(output).toContain(text);
    expect(output).toContain("Next actions");
    expect(output).toContain("vspec usecase list");
    expect(output).toContain("vspec usecase verify <usecase-key>");
    expect(output).not.toContain("ApiError");
    expect(process.exitCode).toBe(1);
  });
});

function flags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function stubNotFound() {
  const fetchSpy = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: 404, title: "Use case not found" }), {
        headers: { "content-type": "application/json" },
        status: 404
      })
    )
  );
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function parseEnvelope(lines: string[]): ErrorEnvelope {
  const envelope = JSON.parse(lines.join("\n")) as ErrorEnvelope;
  expect(envelope.status).toBe("error");
  return envelope;
}
