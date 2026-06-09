import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runSession } from "../../src/commands/session.js";

type SessionAgentEnvelope = {
  context: {
    session_id: null | string;
  };
  data: {
    released_lock_ids?: string[];
    session?: {
      ended_at?: string;
      id: string;
      project_id?: string;
      started_at?: string;
      status: string;
    };
    session_file?: {
      path: string;
    };
    sessions?: unknown[];
    summary?: {
      total_conflicts: number;
    };
    total?: number;
  };
  format_version: 1;
  suggested_next_actions: unknown[];
  warnings: unknown[];
};

type SessionAgentErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
  status: "error";
  suggested_next_actions: Array<{
    command: string;
    reason?: string;
  }>;
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

describe("session --format=agent", () => {
  test("agent session start", async () => {
    stubFetch(sessionStartBody());
    const lines: string[] = [];

    await runSession(sessionFlags({ format: "agent" }), "start", undefined, (line) =>
      lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    const session = requiredValue(envelope.data.session);
    const sessionFile = requiredValue(envelope.data.session_file);
    expect(session.id).toBe("session-1");
    expect(session.project_id).toBe("project-1");
    expect(session.started_at).toBe("2026-05-22T00:00:00.000Z");
    expect(session.status).toBe("ACTIVE");
    expect(sessionFile.path).toBe(".vspec/session.json");
    expect(envelope.context.session_id).toBe("session-1");
  });

  test("agent session start renders missing pin as an error envelope", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const flags = sessionFlags({ format: "agent" });
    delete flags.pin;
    const lines: string[] = [];

    await runSession(flags, "start", undefined, (line) => lines.push(line));

    const envelope = JSON.parse(lines.join("\n")) as SessionAgentErrorEnvelope;
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "BAD_REQUEST",
      message: "Missing --pin."
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command: 'vspec session start --intent "..." --pin <KEY-NNN>',
      reason: "Start a session after the target use case key exists."
    });
    expect(process.exitCode).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("agent session list", async () => {
    stubFetch(sessionListBody());
    const lines: string[] = [];

    await runSession(sessionFlags({ format: "agent" }), "list", undefined, (line) =>
      lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.sessions).toHaveLength(1);
    expect(envelope.data.total).toBe(1);
    expect(requiredValue(envelope.data.summary).total_conflicts).toBe(0);
    expect(envelope.context.session_id).toBeNull();
  });

  test("agent session complete", async () => {
    stubFetch(sessionCompleteBody());
    const lines: string[] = [];

    await runSession(
      sessionFlags({ format: "agent" }),
      "complete",
      "session-1",
      (line) => lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    const session = requiredValue(envelope.data.session);
    const sessionFile = requiredValue(envelope.data.session_file);
    expect(session.id).toBe("session-1");
    expect(session.ended_at).toBe("2026-05-22T01:00:00.000Z");
    expect(session.status).toBe("COMPLETED");
    expect(envelope.data.released_lock_ids).toEqual(["lock-1"]);
    expect(sessionFile.path).toBe(".vspec/session.json");
    expect(envelope.context.session_id).toBe("session-1");
  });

  test("agent session complete resolves the current session file", async () => {
    const requests: string[] = [];
    stubFetch(sessionCompleteBody(), requests);
    const root = mkdtempSync(join(tmpdir(), "vspec-session-unit-"));
    mkdirSync(join(root, ".vspec"), { recursive: true });
    writeFileSync(
      join(root, ".vspec/session.json"),
      `${JSON.stringify({ project_id: "project-1", session_id: "session-1" })}\n`
    );
    const lines: string[] = [];

    await runSession(
      sessionFlags({ format: "agent", root }),
      "complete",
      undefined,
      (line) => lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.context.session_id).toBe("session-1");
    expect(requests).toEqual([
      "https://api.example.test/v1/sessions/session-1/complete"
    ]);
  });

  test("agent session complete without an active session returns an error envelope", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const lines: string[] = [];

    await runSession(sessionFlags({ format: "agent" }), "complete", undefined, (line) =>
      lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as SessionAgentErrorEnvelope;
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "MISSING_SESSION_ID",
      message: "No active session id supplied and no active session file was found."
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command: "vspec session complete <id>",
      reason: "Complete a specific active session when no local session file exists."
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command: "vspec session list",
      reason: "List active sessions and choose the id to complete."
    });
    expect(process.exitCode).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("agent session complete renders API 404 as an error envelope", async () => {
    stubFetchFailure(
      {
        status: 404,
        suggested_next_actions: [
          {
            command: "vspec session list",
            reason: "Find an active session id."
          }
        ],
        title: "Session not found"
      },
      404
    );
    const lines: string[] = [];

    await runSession(
      sessionFlags({ format: "agent" }),
      "complete",
      "missing-session",
      (line) => lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as SessionAgentErrorEnvelope;
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "NOT_FOUND",
      message: "Session not found"
    });
    expect(envelope.suggested_next_actions).toEqual([
      {
        command: "vspec session list",
        reason: "Find an active session id."
      }
    ]);
    expect(process.exitCode).toBe(1);
  });

  test("human session start", async () => {
    stubFetch(sessionStartBody());
    const lines: string[] = [];

    await runSession(sessionFlags(), "start", undefined, (line) => lines.push(line));

    expect(lines).toContain("Session session-1");
    expect(lines).toContain("Intent Implement checkout");
  });

  test("human session list", async () => {
    stubFetch(sessionListBody());
    const lines: string[] = [];

    await runSession(sessionFlags(), "list", undefined, (line) => lines.push(line));

    expect(lines).toContain("Total sessions 1");
    expect(lines).toContain("Session session-1");
  });

  test("human session complete", async () => {
    stubFetch(sessionCompleteBody());
    const lines: string[] = [];

    await runSession(sessionFlags(), "complete", "session-1", (line) =>
      lines.push(line)
    );

    expect(lines).toContain("Session session-1");
    expect(lines).toContain("Status COMPLETED");
  });
});

function stubFetch(body: unknown, requests: string[] = []): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      requests.push(url);
      return Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(body),
        ok: true
      } as Response);
    })
  );
}

function stubFetchFailure(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(body),
        ok: false,
        status
      } as Response)
    )
  );
}

function sessionFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "agent-type": "CODEX",
    intent: "Implement checkout",
    pin: "AGT-001",
    "project-id": "project-1",
    root: mkdtempSync(join(tmpdir(), "vspec-session-unit-")),
    "session-cookie": "session-token",
    "workspace-id": "workspace-1",
    ...overrides
  };
}

function sessionStartBody() {
  return {
    session: {
      agent_identifier: "codex-cli",
      agent_type: "CODEX",
      id: "session-1",
      intent: "Implement checkout",
      pinned_revisions: { "usecase-1": "revision-1" },
      project_id: "project-1",
      started_at: "2026-05-22T00:00:00.000Z",
      status: "ACTIVE"
    },
    session_file: {
      path: ".vspec/session.json",
      session_id: "session-1"
    },
    suggested_next_actions: [
      {
        command: "vspec usecase show AGT-001",
        reason: "Open the pinned use case revision."
      }
    ]
  };
}

function sessionListBody() {
  return {
    sessions: [
      {
        agent_identifier: "codex-cli",
        agent_type: "CODEX",
        branch_name: null,
        conflict_markers: [],
        id: "session-1",
        idle_seconds: 0,
        intent: "Implement checkout",
        lock_count: 0,
        markers: [],
        pinned_keys: ["AGT-001"],
        status: "ACTIVE"
      }
    ],
    suggested_next_actions: [
      {
        command: 'vspec session start --intent "..."',
        reason: "Start a session when work begins."
      }
    ],
    summary: { total_conflicts: 0 },
    total: 1
  };
}

function sessionCompleteBody() {
  return {
    released_lock_ids: ["lock-1"],
    session: {
      ended_at: "2026-05-22T01:00:00.000Z",
      id: "session-1",
      status: "COMPLETED"
    },
    session_file: {
      cleared: true,
      path: ".vspec/session.json"
    },
    suggested_next_actions: [
      {
        command: "vspec merge open",
        reason: "Open a merge request for the completed branch later."
      }
    ]
  };
}

function expectAgentEnvelope(lines: string[]): {
  context: { session_id: null | string };
  data: SessionAgentEnvelope["data"];
} {
  const envelope = JSON.parse(lines.join("\n")) as unknown as SessionAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function requiredValue<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}
