import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  type Actor,
  type ProjectSetup
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;

describe("actor management routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "Actor Mgmt", "actor-mgmt", "actor-mgmt");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("lists only active actors through real routing", async () => {
    const buyer = await createActor(server, setup, "Buyer");
    const supplier = await createActor(server, setup, "Supplier");

    const archive = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/${supplier.id}`,
      { method: "DELETE", headers: { Cookie: setup.cookie } }
    );
    expect(archive.status).toBe(200);

    const response = await server.fetch(`/v1/projects/${setup.projectId}/actors`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ id: string; name: string }>;
    };
    expect(body.items).toEqual([{ ...actorListItem(buyer), name: "Buyer" }]);
    expect(body.items.map((item) => item.id)).not.toContain(supplier.id);
  });

  test("shows actors and reports missing records through real routing", async () => {
    const buyer = await createActor(server, setup, "Buyer");

    const shown = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/${buyer.id}`,
      { headers: { Cookie: setup.cookie } }
    );
    expect(shown.status).toBe(200);
    expect((await shown.json()) as unknown).toEqual({
      actor: {
        aliases: [],
        description: "",
        id: buyer.id,
        is_human: true,
        name: "Buyer",
        type: "PRIMARY"
      }
    });

    const missing = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/actor-missing`,
      { headers: { Cookie: setup.cookie } }
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ title: "Actor not found" });
  });

  test("patches actors with partial updates through real routing", async () => {
    const buyer = await createActor(server, setup, "Buyer");

    const patched = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/${buyer.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({
          aliases: ["shopper"],
          is_human: false,
          type: "SUPPORTING"
        })
      }
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()) as unknown).toMatchObject({
      actor: { aliases: ["shopper"], id: buyer.id, is_human: false, type: "SUPPORTING" }
    });

    const reread = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/${buyer.id}`,
      { headers: { Cookie: setup.cookie } }
    );
    expect((await reread.json()) as unknown).toMatchObject({
      actor: {
        aliases: ["shopper"],
        is_human: false,
        name: "Buyer",
        type: "SUPPORTING"
      }
    });
  });

  test("rejects invalid patch payloads through real routing", async () => {
    const buyer = await createActor(server, setup, "Buyer");

    const response = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/${buyer.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({ name: "" })
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid actor update" });
  });

  test("rejects patches for missing actors through real routing", async () => {
    const response = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/actor-missing`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({ description: "Updated" })
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Actor not found" });
  });

  test("archives actors and reports missing archives through real routing", async () => {
    const buyer = await createActor(server, setup, "Buyer");

    const archived = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/${buyer.id}`,
      { method: "DELETE", headers: { Cookie: setup.cookie } }
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()) as unknown).toEqual({
      actor: { id: buyer.id },
      archived: true
    });

    const missing = await server.fetch(
      `/v1/projects/${setup.projectId}/actors/actor-missing`,
      { method: "DELETE", headers: { Cookie: setup.cookie } }
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ title: "Actor not found" });
  });
});

function actorListItem(actor: Actor) {
  return {
    aliases: [],
    description: "",
    id: actor.id,
    is_human: true,
    type: "PRIMARY"
  };
}
