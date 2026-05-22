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
            items: [
              {
                id: "actor-1",
                name: "Customer",
                type: "PRIMARY"
              }
            ]
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/actors",
      {
        headers: {
          Cookie: "vspec_session=session-token"
        }
      }
    );
    expect(lines).toEqual(["Customer PRIMARY actor-1"]);
  });

  test("shows an actor from the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            actor: {
              id: "actor-1",
              name: "Customer",
              type: "PRIMARY"
            }
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/actors/actor-1",
      {
        headers: {
          Cookie: "vspec_session=session-token"
        }
      }
    );
    expect(lines).toEqual(["Customer PRIMARY actor-1"]);
  });

  test("edits an actor through the API", async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            actor: {
              id: "actor-1",
              name: "Buyer",
              type: "PRIMARY"
            }
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/actors/actor-1",
      {
        body: JSON.stringify({ name: "Buyer" }),
        headers: {
          "Content-Type": "application/json",
          Cookie: "vspec_session=session-token"
        },
        method: "PATCH"
      }
    );
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

    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/actors/actor-1",
      {
        headers: {
          Cookie: "vspec_session=session-token"
        },
        method: "DELETE"
      }
    );
    expect(lines).toEqual(["Archived actor-1"]);
  });
});
