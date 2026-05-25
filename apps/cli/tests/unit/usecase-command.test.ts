import { afterEach, describe, expect, test, vi } from "vitest";

import { runUsecase } from "../../src/commands/usecase.js";

afterEach(() => {
  vi.unstubAllGlobals();
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/usecases/usecase-1",
      {
        body: JSON.stringify({ status: "APPROVED" }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "vspec_session=session-token"
        },
        method: "PATCH"
      }
    );
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/usecases/usecase-1",
      {
        body: JSON.stringify({ title: "Reviews checkout status" }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "vspec_session=session-token"
        },
        method: "PATCH"
      }
    );
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/usecases/usecase-1",
      {
        body: JSON.stringify({ archived_at: null }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "vspec_session=session-token"
        },
        method: "PATCH"
      }
    );
    expect(lines).toEqual(["UseCase PAY-001", "Restored"]);
  });
});
