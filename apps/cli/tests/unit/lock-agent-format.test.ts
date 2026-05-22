import { afterEach, describe, expect, test, vi } from "vitest";

import { runLock } from "../../src/commands/lock.js";

type LockAgentEnvelope = {
  context: {
    session_id: null | string;
  };
  data: {
    lock: {
      held_by_session_id: null | string;
      id: string;
      lock_type: string;
      target_id: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lock acquire --format=agent", () => {
  test("agent lock acquire", async () => {
    stubFetch(lockBody());
    const lines: string[] = [];

    await runLock(lockFlags({ format: "agent" }), "acquire", "LCK-001", (line) => lines.push(line));

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.lock.id).toBe("lock-1");
    expect(envelope.data.lock.lock_type).toBe("SEMANTIC");
    expect(envelope.data.lock.target_id).toBe("LCK-001");
    expect(envelope.data.lock.held_by_session_id).toBe("session-1");
    expect(envelope.context.session_id).toBe("session-1");
    expect(envelope.suggested_next_actions.at(0)?.command).toBe("vspec lock renew lock-1");
  });

  test("human lock acquire", async () => {
    stubFetch(lockBody());
    const lines: string[] = [];

    await runLock(lockFlags(), "acquire", "LCK-001", (line) => lines.push(line));

    expect(lines).toContain("Lock lock-1");
    expect(lines).toContain("Type SEMANTIC");
    expect(lines).toContain("Holder session-1");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response)));
}

function lockFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    reason: "Editing the success scenario.",
    session: "session-1",
    "session-cookie": "session-token",
    ttl: "15",
    type: "semantic",
    ...overrides
  };
}

function lockBody() {
  return {
    lock: {
      auto_release: true,
      expires_at: "2026-05-22T00:15:00.000Z",
      held_by_session_id: "session-1",
      held_by_user_id: "user-1",
      id: "lock-1",
      lock_type: "SEMANTIC",
      target_id: "LCK-001"
    },
    suggested_next_actions: [
      { command: "vspec lock renew lock-1" },
      { command: "vspec unlock LCK-001" }
    ]
  };
}

function expectAgentEnvelope(lines: string[]): LockAgentEnvelope {
  const envelope = JSON.parse(lines.join("\n")) as unknown as LockAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
