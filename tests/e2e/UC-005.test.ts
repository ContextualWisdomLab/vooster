import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type ProjectResponse = {
  project: { id: string };
};

type ActorResponse = {
  actor: {
    id: string;
    project_id: string;
    name: string;
    type: string;
    is_human: boolean;
    description: string;
    aliases: string[];
    archived_at: null;
  };
  revision: {
    entity_type: string;
    entity_id: string;
    version_number: number;
    snapshot: unknown;
  };
  recommended_next_command: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-005 - Define an actor", () => {
  test("MAIN: project member defines an actor with an initial revision", async () => {
    const setup = await createProject("Actor Project", "actor-project", "stub-actor-owner");

    const response = await server.fetch(`/v1/projects/${setup.projectId}/actors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setup.cookie
      },
      body: JSON.stringify({
        name: "Customer",
        type: "PRIMARY",
        is_human: true,
        description: "Person buying a product.",
        aliases: ["Buyer", "Shopper"]
      })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ActorResponse;
    expect(body.actor).toMatchObject({
      project_id: setup.projectId,
      name: "Customer",
      type: "PRIMARY",
      is_human: true,
      description: "Person buying a product.",
      aliases: ["Buyer", "Shopper"],
      archived_at: null
    });
    expect(body.revision).toMatchObject({
      entity_type: "ACTOR",
      entity_id: body.actor.id,
      version_number: 1
    });
    expect(body.recommended_next_command).toBe("vspec stakeholder create");
  });
});

async function createProject(name: string, slug: string, code: string) {
  const signedUp = await signup(name, slug, code);
  const response = await server.fetch(`/v1/workspaces/${signedUp.workspaceId}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: signedUp.cookie },
    body: JSON.stringify({ name: "Checkout", key: "CHK", visibility: "PRIVATE" })
  });
  const body = (await response.json()) as ProjectResponse;

  return { ...signedUp, projectId: body.project.id };
}

async function signup(name: string, slug: string, code: string) {
  const start = await server.fetch("/v1/auth/github/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: { name, slug } })
  });
  const startBody = (await start.json()) as { state: string };
  const callback = await server.fetch(
    `/v1/auth/github/callback?${new URLSearchParams({ code, state: startBody.state })}`,
    { headers: { Cookie: start.headers.get("set-cookie") ?? "" } }
  );
  const body = (await callback.json()) as { workspace: { id: string } };

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: body.workspace.id
  };
}
