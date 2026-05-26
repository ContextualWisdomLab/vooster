import { afterEach, describe, expect, test, vi } from "vitest";

import { runHistory } from "../../src/commands/history.js";

type HistoryAgentEnvelope = {
  context: {
    revision: null | string;
  };
  data: {
    revisions: Array<{
      revision: string;
    }>;
    usecase: {
      key: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("history --format=agent", () => {
  test("agent history", async () => {
    stubFetch(historyBody());
    const lines: string[] = [];

    await runHistory(historyFlags({ format: "agent" }), "HIS-001", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("UseCase ");
    expect(stdout).not.toContain("Limit ");
    expect(stdout).not.toContain("Truncated ");
    expect(stdout).not.toContain("Suppressed ");
    expect(stdout).not.toContain("Revision ");
    expect(stdout).not.toContain("Version ");
    expect(stdout).not.toContain("Entity ");
    expect(stdout).not.toContain("Author ");
    expect(stdout).not.toContain("Timestamp ");
    expect(stdout).not.toContain("\nCreated use case\n");
    const envelope = expectAgentEnvelope(stdout);
    const firstRevision = firstHistoryRevision(envelope);
    expect(envelope.data.usecase.key).toBe("HIS-001");
    expect(firstRevision.revision).toBe("revision-2");
    expect(envelope.context.revision).toBe("revision-2");
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec usecase show"
    );
  });

  test("agent history without revisions", async () => {
    stubFetch({
      limit: 10,
      revisions: [],
      suggested_next_actions: [],
      suppressed_count: 0,
      truncated: false,
      usecase: { key: "HIS-001" }
    });
    const lines: string[] = [];

    await runHistory(historyFlags({ format: "agent" }), "HIS-001", (line) =>
      lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines.join("\n"));
    expect(envelope.context.revision).toBeNull();
  });

  test("human history", async () => {
    stubFetch(historyBody());
    const lines: string[] = [];

    await runHistory(historyFlags(), "HIS-001", (line) => lines.push(line));

    expect(lines).toContain("UseCase HIS-001");
    expect(lines).toContain("Revision revision-2");
    expect(lines).toContain("Version 2");
    expect(lines).toContain("Created use case");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(body),
        ok: true
      } as Response)
    )
  );
}

function historyFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function historyBody() {
  return {
    limit: 10,
    revisions: [
      {
        author: "user-1",
        change_summary: "Created use case",
        entity_id: "usecase-1",
        entity_type: "USECASE",
        revision: "revision-2",
        timestamp: "2026-05-22T00:00:00.000Z",
        version_number: 2
      }
    ],
    suggested_next_actions: [
      {
        command: "vspec usecase show HIS-001 --revision=revision-2",
        reason: "Inspect the selected revision."
      }
    ],
    suppressed_count: 0,
    truncated: false,
    usecase: { key: "HIS-001" }
  };
}

function expectAgentEnvelope(stdout: string): HistoryAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as HistoryAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function firstHistoryRevision(envelope: HistoryAgentEnvelope): { revision: string } {
  const firstRevision = envelope.data.revisions[0];
  expect(firstRevision).toBeDefined();
  return firstRevision as { revision: string };
}
