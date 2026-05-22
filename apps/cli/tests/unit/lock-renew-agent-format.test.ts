import { afterEach, describe, expect, test, vi } from "vitest";

import { runLock } from "../../src/commands/lock.js";

type LockAgentEnvelope = {
  context: {
    session_id: null | string;
  };
  data: {
    lock: {
      expires_at: string;
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
type CapturedRequest = {
  body: string;
  headers: Record<string, string>;
  url: string;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lock renew --format=agent", () => {
  test("agent lock renew", async () => {
    const requests = stubFetch(lockBody());
    const lines: string[] = [];

    await runLock(lockFlags({ format: "agent" }), "renew", "lock-1", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.lock.id).toBe("lock-1");
    expect(envelope.data.lock.lock_type).toBe("SEMANTIC");
    expect(envelope.data.lock.target_id).toBe("LCK-001");
    expect(envelope.data.lock.expires_at).toBe("2026-05-22T00:45:00.000Z");
    expect(envelope.data.lock.held_by_session_id).toBe("session-1");
    expect(envelope.context.session_id).toBe("session-1");
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
    const request = requests.at(0);
    expect(request?.url).toContain("/v1/locks/");
    expect(request?.url).toContain("/renew");
    expect(JSON.parse(request?.body ?? "{}")).toEqual({ ttl_minutes: 15 });
    expect(request?.headers["X-Vspec-Session"]).toBe("session-1");
  });

  test("agent lock renew without session", async () => {
    const requests = stubFetch(lockBody({ heldBySessionId: null }));
    const lines: string[] = [];

    await runLock(lockFlags({ format: "agent", session: undefined }), "renew", "lock-1", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.context.session_id).toBeNull();
    expect(envelope.data.lock.held_by_session_id).toBeNull();
    expect(requests.at(0)?.headers).not.toHaveProperty("X-Vspec-Session");
  });

  test("human lock renew", async () => {
    stubFetch(lockBody());
    const lines: string[] = [];

    await runLock(lockFlags(), "renew", "lock-1", (line) => lines.push(line));

    expect(lines).toContain("Lock lock-1");
    expect(lines).toContain("Type SEMANTIC");
    expect(lines).toContain("Holder session-1");
    expect(lines).toContain("Expires at 2026-05-22T00:45:00.000Z");
  });
});

function stubFetch(body: unknown): CapturedRequest[] {
  const requests: CapturedRequest[] = [];
  const fetch = vi.fn((url: string | URL, init?: RequestInit) => {
    requests.push({
      body: bodyText(init?.body),
      headers: recordHeaders(init?.headers),
      url: String(url)
    });
    return Promise.resolve({
      headers: new Headers(),
      json: () => Promise.resolve(body),
      ok: true
    } as Response);
  });
  vi.stubGlobal("fetch", fetch);
  return requests;
}

function bodyText(body: RequestInit["body"]): string {
  return typeof body === "string" ? body : "";
}

function recordHeaders(headers: RequestInit["headers"]): Record<string, string> {
  if (headers === undefined || Array.isArray(headers) || headers instanceof Headers) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, typeof value === "string" ? value : value.join(", ")])
  );
}

function lockFlags(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const flags: Record<string, string | undefined> = {
    "api-url": "https://api.example.test",
    session: "session-1",
    "session-cookie": "session-token",
    ttl: "15",
    ...overrides
  };
  const defined: Record<string, string> = {};
  for (const [key, value] of Object.entries(flags)) {
    if (value !== undefined) {
      defined[key] = value;
    }
  }
  return defined;
}

function lockBody(overrides: { heldBySessionId?: null | string } = {}) {
  return {
    lock: {
      auto_release: true,
      expires_at: "2026-05-22T00:45:00.000Z",
      held_by_session_id: Object.hasOwn(overrides, "heldBySessionId") ? overrides.heldBySessionId : "session-1",
      held_by_user_id: "user-1",
      id: "lock-1",
      lock_type: "SEMANTIC",
      target_id: "LCK-001"
    }
  };
}

function expectAgentEnvelope(stdout: string): LockAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as LockAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
