import { afterEach, describe, expect, test, vi } from "vitest";

import { runStakeholder } from "../../src/commands/stakeholder.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stakeholder command", () => {
  test("lists stakeholders from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            items: [stakeholderBody({ name: "Customer" })]
          }),
        ok: true
      } as Response)
    );
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

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Customer EXTERNAL stakeholder-1"]);
  });

  test("shows a stakeholder from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            stakeholder: stakeholderBody({ name: "Customer" })
          }),
        ok: true
      } as Response)
    );
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

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Customer EXTERNAL stakeholder-1"]);
  });

  test("edits a stakeholder through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            stakeholder: stakeholderBody({ name: "Buyer" })
          }),
        ok: true
      } as Response)
    );
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

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Buyer EXTERNAL stakeholder-1"]);
  });

  test("archives a stakeholder through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            archived: true,
            stakeholder: { id: "stakeholder-1" }
          }),
        ok: true
      } as Response)
    );
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

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Archived stakeholder-1"]);
  });
});

function stakeholderBody(overrides: { name: string }) {
  return {
    description: "",
    id: "stakeholder-1",
    name: overrides.name,
    type: "EXTERNAL"
  };
}
