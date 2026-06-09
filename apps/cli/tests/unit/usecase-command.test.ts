import { afterEach, describe, expect, test, vi } from "vitest";

import { runUsecase } from "../../src/commands/usecase.js";

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

describe("usecase command", () => {
  test("sets use case status through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            usecase: {
              format: "BRIEF",
              key: "PAY-001",
              level: "USER_GOAL",
              priority: "P1",
              scope: "checkout",
              status: "APPROVED",
              title: "Submit an order"
            }
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        field: "status",
        "session-cookie": "session-token",
        value: "APPROVED"
      },
      "set",
      "usecase-1",
      (message) => lines.push(message)
    );

    expect(requestFrom(fetchStub)).toEqual({
      body: { status: "APPROVED" },
      method: "PATCH",
      url: "https://api.example.test/v1/usecases/usecase-1"
    });
    expect(lines).toEqual([
      "UseCase PAY-001",
      "Title Submit an order",
      "Level USER_GOAL",
      "Format BRIEF",
      "Status APPROVED",
      "Priority P1",
      "Scope checkout"
    ]);
  });

  test("sets use case title through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            usecase: {
              format: "BRIEF",
              key: "PAY-001",
              level: "USER_GOAL",
              priority: "P2",
              scope: "checkout",
              status: "DRAFT",
              title: "Reviews checkout status"
            }
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        field: "title",
        "session-cookie": "session-token",
        value: "Reviews checkout status"
      },
      "set",
      "usecase-1",
      (message) => lines.push(message)
    );

    expect(requestFrom(fetchStub)).toEqual({
      body: { title: "Reviews checkout status" },
      method: "PATCH",
      url: "https://api.example.test/v1/usecases/usecase-1"
    });
    expect(lines).toContain("Title Reviews checkout status");
  });

  test("sets use case metadata with an agent envelope", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            usecase: {
              format: "BRIEF",
              key: "PAY-001",
              level: "USER_GOAL",
              priority: "P2",
              scope: "checkout",
              status: "DRAFT",
              title: "Reviews checkout status"
            }
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        field: "title",
        format: "agent",
        "session-cookie": "session-token",
        value: "Reviews checkout status"
      },
      "set",
      "usecase-1",
      (message) => lines.push(message)
    );

    const envelope = JSON.parse(lines.join("\n")) as {
      data: { usecase: { title: string } };
      format_version: number;
    };
    expect(envelope.format_version).toBe(1);
    expect(envelope.data.usecase.title).toBe("Reviews checkout status");
  });

  test("agent set rejects an unsupported field with a teaching envelope", async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        field: "unknown",
        format: "agent",
        "session-cookie": "session-token",
        value: "SUMMARY"
      },
      "set",
      "usecase-1",
      (message) => lines.push(message)
    );

    const stdout = lines.join("\n");
    const envelope = JSON.parse(stdout) as AgentErrorEnvelope;
    expect(stdout).not.toContain("ZodError");
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "BAD_REQUEST",
      message:
        "Supported --field values: title, level, priority, format, status, scope."
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command:
        "vspec usecase set <usecase-id> --field title|level|priority|format|status|scope --value <value>",
      reason: "Choose one of the supported metadata fields."
    });
    expect(process.exitCode).toBe(1);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  test("agent set rejects an invalid level with a schema envelope", async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        field: "level",
        format: "agent",
        "session-cookie": "session-token",
        value: "BOGUS"
      },
      "set",
      "usecase-1",
      (message) => lines.push(message)
    );

    const stdout = lines.join("\n");
    const envelope = JSON.parse(stdout) as AgentErrorEnvelope;
    expect(stdout).not.toContain("ZodError");
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "SCHEMA_INVALID",
      message: "Invalid use case update."
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command: "vspec usecase set <usecase-id> --field level --value SUMMARY",
      reason: "Allowed levels are SUMMARY, USER_GOAL, and SUBFUNCTION."
    });
    expect(process.exitCode).toBe(1);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  test("agent set maps API 404 to an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          headers: new Headers(),
          json: () => Promise.resolve({ title: "Use case not found" }),
          ok: false,
          status: 404
        } as Response)
      )
    );
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        field: "title",
        format: "agent",
        "session-cookie": "session-token",
        value: "Reviews checkout status"
      },
      "set",
      "missing-usecase",
      (message) => lines.push(message)
    );

    const stdout = lines.join("\n");
    const envelope = JSON.parse(stdout) as AgentErrorEnvelope;
    expect(stdout).not.toContain("ApiError");
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "NOT_FOUND",
      message: "Use case not found"
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command: "vspec usecase list",
      reason: "Find an existing use case key before setting metadata."
    });
    expect(process.exitCode).toBe(1);
  });

  test("restores an archived use case through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            usecase: {
              archived_at: null,
              key: "PAY-001"
            }
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runUsecase(
      {
        "api-url": "https://api.example.test",
        "session-cookie": "session-token"
      },
      "restore",
      "usecase-1",
      (message) => lines.push(message)
    );

    expect(requestFrom(fetchStub)).toEqual({
      body: { archived_at: null },
      method: "PATCH",
      url: "https://api.example.test/v1/usecases/usecase-1"
    });
    expect(lines).toEqual(["UseCase PAY-001", "Restored"]);
  });
});

type AgentErrorEnvelope = {
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

function requestFrom(fetchStub: ReturnType<typeof vi.fn>) {
  const call = fetchStub.mock.calls[0] as
    | [string, { body?: string; method?: string }]
    | undefined;
  const [url, init] = call ?? ["", {}];
  const body = init.body ?? "{}";
  return {
    body: JSON.parse(body) as unknown,
    method: init.method,
    url
  };
}
