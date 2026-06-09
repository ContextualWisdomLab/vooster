import { afterEach, describe, expect, test, vi } from "vitest";

import { runActor } from "../../src/commands/actor.js";

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
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

  test.each(["show", "edit", "archive", "list"] as const)(
    "prints a structured agent error for actor %s API failures",
    async (action) => {
      vi.stubGlobal("fetch", actorNotFoundFetch());
      const lines: string[] = [];

      await runActor(
        {
          "api-url": "https://api.example.test",
          format: "agent",
          name: "Probe",
          "project-id": "project-1",
          "session-cookie": "session-token",
          type: "PRIMARY"
        },
        action,
        "Account Holder",
        (message) => lines.push(message)
      );

      expect(lines.join("\n")).not.toContain("ApiError");
      expect(process.exitCode).toBe(1);
      const envelope = parseAgentError(lines);
      expect(envelope.error?.code).toBe("NOT_FOUND");
    }
  );

  test.each(["show", "edit", "archive"] as const)(
    "teaches unresolved actor lookup recovery in agent output for %s",
    async (action) => {
      vi.stubGlobal("fetch", actorNotFoundFetch());
      const lines: string[] = [];

      await runActor(
        {
          "api-url": "https://api.example.test",
          format: "agent",
          name: "Probe",
          "project-id": "project-1",
          "session-cookie": "session-token",
          type: "PRIMARY"
        },
        action,
        "Account Holder",
        (message) => lines.push(message)
      );

      const envelope = parseAgentError(lines);
      expect(envelope.error?.message).toContain('Actor "Account Holder"');
      expect(envelope.error?.message).toContain("id");
      const nextAction = envelope.suggested_next_actions.find(
        (action) => action.command === "vspec actor list"
      );
      expect(nextAction?.reason).toContain("id");
    }
  );

  test.each(["show", "edit", "archive"] as const)(
    "teaches unresolved actor lookup recovery in human output for %s",
    async (action) => {
      vi.stubGlobal("fetch", actorNotFoundFetch());
      const lines: string[] = [];

      await runActor(
        {
          "api-url": "https://api.example.test",
          name: "Probe",
          "project-id": "project-1",
          "session-cookie": "session-token",
          type: "PRIMARY"
        },
        action,
        "Account Holder",
        (message) => lines.push(message)
      );

      const output = lines.join("\n");
      expect(output).not.toContain("ApiError");
      expect(output).toContain('Actor "Account Holder"');
      expect(output).toContain("id");
      expect(output).toContain("Next actions");
      expect(output).toContain("vspec actor list");
      expect(process.exitCode).toBe(1);
    }
  );
});

type AgentErrorEnvelope = {
  status: "error";
  error?: {
    code: string;
    message: string;
  };
  suggested_next_actions: Array<{
    command: string;
    reason?: string;
  }>;
};

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

function actorNotFoundFetch() {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: 404, title: "Actor not found" }), {
        headers: { "content-type": "application/json" },
        status: 404
      })
    )
  );
}

function parseAgentError(lines: string[]): AgentErrorEnvelope {
  const envelope = JSON.parse(lines.join("\n")) as AgentErrorEnvelope;
  expect(envelope.status).toBe("error");
  return envelope;
}
