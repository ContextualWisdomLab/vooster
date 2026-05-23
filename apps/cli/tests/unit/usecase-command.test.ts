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
              key: "PAY-001",
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
    expect(lines).toEqual(["UseCase PAY-001", "Status APPROVED"]);
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
