import { afterEach, describe, expect, test, vi } from "vitest";

import { runStakeholder } from "../../src/commands/stakeholder.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stakeholder command", () => {
  test("lists stakeholders from the API", async () => {
    const fetchStub = vi.fn(() => Promise.resolve({
      headers: new Headers(),
      json: () => Promise.resolve({
        items: [
          {
            id: "stakeholder-1",
            name: "Customer",
            type: "EXTERNAL"
          }
        ]
      }),
      ok: true
    } as Response));
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runStakeholder(
      {
        "api-url": "https://api.example.test",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "list",
      undefined,
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/stakeholders",
      {
        headers: {
          Cookie: "vspec_session=session-token"
        }
      }
    );
    expect(lines).toEqual(["Customer EXTERNAL stakeholder-1"]);
  });

  test("shows a stakeholder from the API", async () => {
    const fetchStub = vi.fn(() => Promise.resolve({
      headers: new Headers(),
      json: () => Promise.resolve({
        stakeholder: {
          id: "stakeholder-1",
          name: "Customer",
          type: "EXTERNAL"
        }
      }),
      ok: true
    } as Response));
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runStakeholder(
      {
        "api-url": "https://api.example.test",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "show",
      "stakeholder-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/stakeholders/stakeholder-1",
      {
        headers: {
          Cookie: "vspec_session=session-token"
        }
      }
    );
    expect(lines).toEqual(["Customer EXTERNAL stakeholder-1"]);
  });

  test("edits a stakeholder through the API", async () => {
    const fetchStub = vi.fn(() => Promise.resolve({
      headers: new Headers(),
      json: () => Promise.resolve({
        stakeholder: {
          id: "stakeholder-1",
          name: "Buyer",
          type: "EXTERNAL"
        }
      }),
      ok: true
    } as Response));
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runStakeholder(
      {
        "api-url": "https://api.example.test",
        name: "Buyer",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "edit",
      "stakeholder-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/stakeholders/stakeholder-1",
      {
        body: JSON.stringify({ name: "Buyer" }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "vspec_session=session-token"
        },
        method: "PATCH"
      }
    );
    expect(lines).toEqual(["Buyer EXTERNAL stakeholder-1"]);
  });

  test("archives a stakeholder through the API", async () => {
    const fetchStub = vi.fn(() => Promise.resolve({
      headers: new Headers(),
      json: () => Promise.resolve({ archived: true }),
      ok: true
    } as Response));
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runStakeholder(
      {
        "api-url": "https://api.example.test",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "archive",
      "stakeholder-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/stakeholders/stakeholder-1",
      {
        headers: {
          Cookie: "vspec_session=session-token"
        },
        method: "DELETE"
      }
    );
    expect(lines).toEqual(["Archived stakeholder-1"]);
  });
});
