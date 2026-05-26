import { afterEach, describe, expect, test, vi } from "vitest";

import { runProject } from "../../src/commands/project.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("project command", () => {
  test("lists projects from the API", async () => {
    const requestedUrls: string[] = [];
    const fetchStub = vi.fn((url: string | URL, init?: RequestInit) => {
      void url;
      void init;
      return Promise.resolve({
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
      } as Response);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL, init?: RequestInit) => {
        requestedUrls.push(String(url));
        return fetchStub(url, init);
      })
    );
    const lines: string[] = [];

    await runProject(
      {
        "api-url": "https://api.example.test",
        "session-cookie": "session-token"
      },
      "list",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledOnce();
    expect(requestedUrls).toEqual(["https://api.example.test/v1/projects"]);
    expect(lines).toEqual(["PAY Payments project-1"]);
  });
});
