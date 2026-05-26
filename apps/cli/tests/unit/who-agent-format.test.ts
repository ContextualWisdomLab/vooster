import { afterEach, describe, expect, test, vi } from "vitest";

import { runWho } from "../../src/commands/who.js";

type WhoAgentEnvelope = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: {
    locks: Array<{
      id: string;
    }>;
    merge_requests: Array<{
      id: string;
    }>;
    sessions: Array<{
      id: string;
    }>;
    usecase: {
      key: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("who --format=agent", () => {
  test("agent who with active work", async () => {
    stubFetch(activeWhoBody());
    const lines: string[] = [];

    await runWho(whoFlags({ format: "agent" }), "WHO-001", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope(stdout);
    expect(stdout).not.toContain("UseCase ");
    expect(stdout).not.toContain("Sessions ");
    expect(stdout).not.toContain("Session ");
    expect(stdout).not.toContain("Agent ");
    expect(stdout).not.toContain("Intent ");
    expect(stdout).not.toContain("Locks ");
    expect(stdout).not.toContain("Lock ");
    expect(stdout).not.toContain("Type ");
    expect(stdout).not.toContain("Holder ");
    expect(stdout).not.toContain("Expires at ");
    expect(stdout).not.toContain("Merge requests ");
    expect(stdout).not.toContain("Merge request ");
    expect(stdout).not.toContain("Source branch ");
    expect(stdout).not.toContain("Status ");
    expect(stdout).not.toContain("Conflicts ");
    expect(envelope.data.usecase.key).toBe("WHO-001");
    expect(envelope.data.sessions.at(0)?.id).toBe("session-1");
    expect(envelope.data.locks.at(0)?.id).toBe("lock-1");
    expect(envelope.data.merge_requests.at(0)?.id).toBe("merge-1");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toBe(
      "vspec merge show merge-1"
    );
    expect(envelope.warnings).toEqual([]);
  });

  test("agent who without active work", async () => {
    stubFetch(emptyWhoBody());
    const lines: string[] = [];

    await runWho(whoFlags({ format: "agent" }), "WHO-001", (line) => lines.push(line));

    const envelope = expectAgentEnvelope(lines.join("\n"));
    expect(envelope.data.usecase.key).toBe("WHO-001");
    expect(envelope.data.sessions).toEqual([]);
    expect(envelope.data.locks).toEqual([]);
    expect(envelope.data.merge_requests).toEqual([]);
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec session start --intent"
    );
  });

  test("human who", async () => {
    stubFetch(activeWhoBody());
    const lines: string[] = [];

    await runWho(whoFlags(), "WHO-001", (line) => lines.push(line));

    expect(lines).toContain("UseCase WHO-001");
    expect(lines).toContain("Sessions 1");
    expect(lines).toContain("Session session-1");
    expect(lines).toContain("Agent CODEX");
    expect(lines).toContain("Intent Coordinate on checkout");
    expect(lines).toContain("Locks 1");
    expect(lines).toContain("Lock lock-1");
    expect(lines).toContain("Type SEMANTIC");
    expect(lines).toContain("Holder session-1");
    expect(lines).toContain("Expires at 2026-05-22T00:30:00.000Z");
    expect(lines).toContain("Merge requests 1");
    expect(lines).toContain("Merge request merge-1");
    expect(lines).toContain("Source branch branch-1");
    expect(lines).toContain("Status OPEN");
    expect(lines).toContain("Conflicts 2");
    expect(lines).toContain("vspec merge show merge-1");
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

function whoFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function activeWhoBody() {
  return {
    locks: [
      {
        expires_at: "2026-05-22T00:30:00.000Z",
        held_by_session_id: "session-1",
        held_by_user_id: "user-1",
        id: "lock-1",
        lock_type: "SEMANTIC"
      }
    ],
    merge_requests: [
      {
        conflict_count: 2,
        id: "merge-1",
        source_branch_id: "branch-1",
        status: "OPEN"
      }
    ],
    sessions: [
      {
        agent_type: "CODEX",
        id: "session-1",
        intent: "Coordinate on checkout",
        markers: []
      }
    ],
    suggested_next_actions: [
      { command: "vspec merge show merge-1", reason: "Review it." }
    ],
    usecase: {
      key: "WHO-001"
    }
  };
}

function emptyWhoBody() {
  return {
    locks: [],
    merge_requests: [],
    sessions: [],
    suggested_next_actions: [
      {
        command: 'vspec session start --intent "..." --pin WHO-001',
        reason: "Start a session."
      }
    ],
    usecase: {
      key: "WHO-001"
    }
  };
}

function expectAgentEnvelope(stdout: string): WhoAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as WhoAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function defaultContext(): WhoAgentEnvelope["context"] {
  return {
    branch: null,
    project_key: null,
    revision: null,
    session_id: null
  };
}
