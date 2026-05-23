import { afterEach, describe, expect, test, vi } from "vitest";

import { runDoctor } from "../../src/commands/doctor.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("doctor command", () => {
  test("sends usecase query parameter for id-or-key diagnostics", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL) => {
        urls.push(url.toString());
        return Promise.resolve({
          headers: new Headers(),
          json: () =>
            Promise.resolve({
              checks: [],
              scope: { project_id: "project-1" },
              status: "ok",
              suggested_next_actions: []
            }),
          ok: true
        } as Response);
      })
    );

    await runDoctor(
      {
        "api-url": "https://api.example.test",
        "session-cookie": "session-token",
        usecase: "PAY-001"
      },
      () => undefined
    );

    expect(urls).toEqual(["https://api.example.test/v1/doctor?usecase=PAY-001"]);
  });
});
