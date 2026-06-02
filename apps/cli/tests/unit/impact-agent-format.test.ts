import { afterEach, describe, expect, test, vi } from "vitest";

import { runImpact } from "../../src/commands/impact.js";

type ImpactAgentEnvelope = {
  context: {
    revision: null | string;
  };
  data: {
    impact: {
      input_hash: string;
      severity: string;
    };
    preview_id: string;
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("impact --format=agent", () => {
  test("agent impact", async () => {
    stubImpactFetch();
    const lines: string[] = [];

    await runImpact(impactFlags({ format: "agent" }), "IMP-001", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("Preview ");
    expect(stdout).not.toContain("Cached ");
    expect(stdout).not.toContain("Severity ");
    expect(stdout).not.toContain("Confidence ");
    expect(stdout).not.toContain("Affected sessions ");
    expect(stdout).not.toContain("Affected branches ");
    expect(stdout).not.toContain("Affected tests ");
    expect(stdout).not.toContain("Input hash ");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.preview_id).toBe("preview-1");
    expect(envelope.data.impact.input_hash).toBe("hash-1");
    expect(envelope.data.impact.severity).toBe("NON_BREAKING");
    expect(envelope.context.revision).toBe("revision-1");
    expect(envelope.suggested_next_actions.at(0)?.command).toContain("vspec lock");
    expect(envelope.warnings).toEqual([]);
  });

  test("human impact", async () => {
    stubImpactFetch();
    const lines: string[] = [];

    await runImpact(impactFlags(), "IMP-001", (line) => lines.push(line));

    expect(lines).toContain("Preview preview-1");
    expect(lines).toContain("Cached false");
    expect(lines).toContain("Severity NON_BREAKING");
    expect(lines).toContain("Confidence 1");
    expect(lines).toContain("Affected sessions none");
    expect(lines).toContain("Affected branches none");
    expect(lines).toContain("Affected tests none");
    expect(lines).toContain("Input hash hash-1");
    expect(lines).toContain("vspec lock IMP-001");
  });
});

function stubImpactFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = input.toString();
      if (url.includes("/v1/usecases/IMP-001/revisions")) {
        return Promise.resolve(jsonResponse(historyResponse()));
      }
      if (url.endsWith("/v1/changes/preview")) {
        return Promise.resolve(jsonResponse(impactResponse()));
      }

      throw new Error("missing history response or impact response");
    })
  );
}

function impactFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function historyResponse() {
  return {
    limit: 1,
    revisions: [
      {
        author: "user-1",
        entity_id: "usecase-1",
        entity_type: "USECASE",
        revision: "revision-1",
        timestamp: "2026-05-22T00:00:00.000Z",
        version_number: 1
      }
    ],
    suggested_next_actions: [],
    suppressed_count: 0,
    truncated: false,
    usecase: { key: "IMP-001" }
  };
}

function impactResponse() {
  return {
    cached: false,
    impact: {
      affected_branches: [],
      affected_sessions: [],
      affected_tests: [],
      confidence: 1,
      input_hash: "hash-1",
      severity: "NON_BREAKING"
    },
    preview_id: "preview-1",
    suggested_next_actions: [
      {
        command: "vspec lock IMP-001",
        reason: "Lock the use case before applying a risky change."
      }
    ]
  };
}

function jsonResponse(body: unknown): Response {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response;
}

function expectAgentEnvelope(stdout: string): ImpactAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as ImpactAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
