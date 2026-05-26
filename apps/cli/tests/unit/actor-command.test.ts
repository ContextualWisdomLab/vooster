import { afterEach, describe, expect, test, vi } from "vitest";

import { runActor } from "../../src/commands/actor.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("actor command", () => {
  test("lists actors from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            items: [actorBody({ name: "Customer" })]
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runActor(
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
    expect(lines).toEqual(["Customer PRIMARY actor-1"]);
  });

  test("shows an actor from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            actor: actorBody({ name: "Customer" })
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runActor(
      {
        "api-url": "https://api.example.test",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "show",
      "actor-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Customer PRIMARY actor-1"]);
  });

  test("edits an actor through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            actor: actorBody({ name: "Buyer" })
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runActor(
      {
        "api-url": "https://api.example.test",
        name: "Buyer",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "edit",
      "actor-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Buyer PRIMARY actor-1"]);
  });

  test("archives an actor through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            actor: {
              id: "actor-1"
            },
            archived: true
          }),
        ok: true
      } as Response)
    );
    vi.stubGlobal("fetch", fetchStub);
    const lines: string[] = [];

    await runActor(
      {
        "api-url": "https://api.example.test",
        "project-id": "project-1",
        "session-cookie": "session-token"
      },
      "archive",
      "actor-1",
      (message) => lines.push(message)
    );

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(["Archived actor-1"]);
  });
});

function actorBody(overrides: { name: string }) {
  return {
    aliases: [],
    description: "",
    id: "actor-1",
    is_human: true,
    name: overrides.name,
    type: "PRIMARY"
  };
}
