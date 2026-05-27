import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type ProjectResponse = { project: { id: string } };

type ActorResponse = {
  actor: Record<"description" | "id" | "name" | "project_id" | "type", string> & {
    aliases: string[];
    archived_at: null;
    is_human: boolean;
  };
  revision: {
    entity_id: string;
    entity_type: string;
    snapshot: unknown;
    version_number: number;
  };
  recommended_next_command: string;
};

type ProblemResponse = {
  title: string;
  existing_actor_id?: string;
  valid_types?: string[];
  suggested_next_actions: Array<{ command: string; reason: string }>;
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
    const setup = await createProject(
      "Actor Project",
      "actor-project",
      "stub-actor-owner"
    );

    const response = await createActor(setup, {
      aliases: ["Buyer", "Shopper"],
      description: "Person buying a product.",
      name: "Customer",
      type: "PRIMARY"
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

  test("3a: duplicate active actor name returns existing actor guidance", async () => {
    const setup = await createProject(
      "Duplicate Actor",
      "duplicate-actor",
      "stub-actor-dup"
    );
    const first = await createActor(setup, { name: "Customer", type: "PRIMARY" });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as ActorResponse;

    const duplicate = await createActor(setup, {
      name: "Customer",
      type: "SUPPORTING"
    });

    expect(duplicate.status).toBe(422);
    const body = (await duplicate.json()) as ProblemResponse;
    expect(body.title).toMatch(/actor name.*already exists/i);
    expect(body.existing_actor_id).toBe(firstBody.actor.id);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor edit",
      reason: "Amend the existing actor."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor edit --add-alias Customer",
      reason: "Attach the submitted name as an alias."
    });
  });

  test("3b: duplicate archived actor name suggests a different name", async () => {
    const setup = await createProject(
      "Archived Actor",
      "archived-actor",
      "stub-actor-archived"
    );
    const created = await createActor(setup, { name: "Customer", type: "PRIMARY" });
    const createdBody = (await created.json()) as ActorResponse;
    await server.fetch(
      `/__test/projects/${setup.projectId}/actors/${createdBody.actor.id}/archive`,
      { method: "POST" }
    );

    const duplicate = await createActor(setup, {
      name: "Customer",
      type: "SUPPORTING"
    });

    expect(duplicate.status).toBe(409);
    const body = (await duplicate.json()) as ProblemResponse;
    expect(body.title).toMatch(/archived actor/i);
    expect(body.existing_actor_id).toBe(createdBody.actor.id);
    expect(body.suggested_next_actions).not.toContainEqual(
      expect.objectContaining({ command: "vspec actor restore" })
    );
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor create",
      reason: "Choose a different name."
    });
  });

  test("4a: invalid actor type lists valid enum values", async () => {
    const setup = await createProject(
      "Invalid Type",
      "invalid-type",
      "stub-actor-type"
    );
    const response = await createActor(setup, {
      name: "Gateway",
      type: "SYSTEM"
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/invalid actor type/i);
    expect(body.valid_types).toEqual(["PRIMARY", "SUPPORTING", "OFFSTAGE"]);
  });

  test("1a: System actor name is reserved", async () => {
    const setup = await createProject(
      "System Actor",
      "system-actor",
      "stub-actor-system"
    );
    const response = await createActor(setup, { name: "System", type: "SUPPORTING" });

    expect(response.status).toBe(422);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/system.*reserved/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor show System",
      reason: "Inspect the canonical system actor."
    });
  });

  test("*a: read-only requester cannot define an actor", async () => {
    const setup = await createProject("Read Only", "read-only", "stub-actor-readonly");
    await server.fetch(
      `/__test/workspaces/${setup.workspaceId}/members/${setup.userId}/read-only`,
      { method: "POST" }
    );

    const response = await createActor(setup, { name: "Customer", type: "PRIMARY" });

    expect(response.status).toBe(403);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/contact the workspace owner/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec workspace owner contact",
      reason: "Request edit access."
    });
  });
});

async function createActor(
  setup: { cookie: string; projectId: string },
  body: { aliases?: string[]; description?: string; name: string; type: string }
) {
  return server.fetch(`/v1/projects/${setup.projectId}/actors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({
      is_human: true,
      aliases: [],
      description: "",
      ...body
    })
  });
}

async function createProject(name: string, slug: string, code: string) {
  const signedUp = await signup(name, slug, code);
  const response = await server.fetch(
    `/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: signedUp.cookie },
      body: JSON.stringify({ name: "Checkout", key: "CHK", visibility: "PRIVATE" })
    }
  );
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
  const params = new URLSearchParams({ code, state: startBody.state });
  const callback = await server.fetch(`/v1/auth/github/callback?${params.toString()}`, {
    headers: { Cookie: start.headers.get("set-cookie") ?? "" }
  });
  const body = (await callback.json()) as {
    user: { id: string };
    workspace: { id: string };
  };

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: body.user.id,
    workspaceId: body.workspace.id
  };
}
