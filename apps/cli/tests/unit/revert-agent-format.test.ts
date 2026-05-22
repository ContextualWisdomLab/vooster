import { afterEach, describe, expect, test, vi } from "vitest";

import { runRevert } from "../../src/commands/revert.js";

type RevertAgentEnvelope = {
  context: {
    revision: null | string;
  };
  data: {
    revision: {
      id: string;
    };
    usecase: {
      current_revision_id: string;
      id: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: Array<{ message: string; type: string }>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("revert --format=agent", () => {
  test("agent revert", async () => {
    stubFetch(revertBody());
    const lines: string[] = [];

    await runRevert(revertFlags({ format: "agent" }), "REV-001", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope(stdout);
    expect(stdout).not.toContain("UseCase ");
    expect(stdout).not.toContain("Title ");
    expect(stdout).not.toContain("Current revision ");
    expect(stdout).not.toContain("Revision ");
    expect(stdout).not.toContain("Parent ");
    expect(stdout).not.toContain("Change ");
    expect(stdout).not.toContain("Version ");
    expect(stdout).not.toContain("Severity ");
    expect(stdout).not.toContain("Impact ");
    expect(stdout).not.toContain("Affected sessions ");
    expect(stdout).not.toContain("Affected branches ");
    expect(stdout).not.toContain("Warning ");
    expect(envelope.data.usecase.current_revision_id).toBe("revision-revert");
    expect(envelope.data.revision.id).toBe("revision-revert");
    expect(envelope.context.revision).toBe(envelope.data.revision.id);
    expect(envelope.context.revision).toBe(envelope.data.usecase.current_revision_id);
    expect(envelope.suggested_next_actions.at(0)?.command).toContain("vspec history");
    expect(envelope.warnings.at(0)?.type).toBe("GHERKIN_DRIFT");
  });

  test("human revert", async () => {
    stubFetch(revertBody());
    const lines: string[] = [];

    await runRevert(revertFlags(), "REV-001", (line) => lines.push(line));

    expect(lines).toContain("UseCase usecase-1");
    expect(lines).toContain("Title Reviews a refund");
    expect(lines).toContain("Current revision revision-revert");
    expect(lines).toContain("Revision revision-revert");
    expect(lines).toContain("Parent revision-2");
    expect(lines).toContain("Change Revert to revision-1");
    expect(lines).toContain("Version 3");
    expect(lines).toContain("Severity NON_BREAKING");
    expect(lines).toContain("Impact NON_BREAKING");
    expect(lines).toContain("Affected sessions none");
    expect(lines).toContain("Affected branches none");
    expect(lines).toContain("Warning GHERKIN_DRIFT Pinned feature files drift.");
    expect(lines).toContain("vspec history REV-001");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response)));
}

function revertFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    to: "revision-1",
    ...overrides
  };
}

function revertBody() {
  return {
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity: "NON_BREAKING"
    },
    revision: {
      change_summary: "Revert to revision-1",
      id: "revision-revert",
      parent_revision_id: "revision-2",
      severity: "NON_BREAKING",
      version_number: 3
    },
    suggested_next_actions: [
      { command: "vspec history REV-001" },
      { command: "vspec session list --status=active" }
    ],
    usecase: {
      current_revision_id: "revision-revert",
      id: "usecase-1",
      title: "Reviews a refund"
    },
    warnings: [
      { message: "Pinned feature files drift.", type: "GHERKIN_DRIFT" }
    ]
  };
}

function expectAgentEnvelope(stdout: string): RevertAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as RevertAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
