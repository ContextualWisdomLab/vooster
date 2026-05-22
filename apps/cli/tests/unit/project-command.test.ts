import { afterEach, describe, expect, test, vi } from "vitest";

import { runProject } from "../../src/commands/project.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("project command", () => {
  test("lists projects from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "project-1",
                key: "PAY",
                name: "Payments",
                visibility: "INTERNAL",
                workspace_id: "workspace-1"
              }
            ]
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runProject(
      {
        "api-url": "https://api.example.test",
        "session-cookie": "session-token"
      },
      "list",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledWith("https://api.example.test/v1/projects", {
      headers: {
        Cookie: "vspec_session=session-token"
      }
    });
    expect(lines).toEqual(["PAY Payments project-1"]);
  });
});
