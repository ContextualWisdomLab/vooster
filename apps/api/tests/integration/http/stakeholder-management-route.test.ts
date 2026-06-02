import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createProject,
  createStakeholder,
  type ProjectSetup,
  type Stakeholder
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;

type ListBody = { items: Array<{ id: string; name: string }> };
type ShowBody = { stakeholder: { id: string; name: string; type: string } };

describe("stakeholder management routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "SH Mgmt", "stakeholder-mgmt", "stub-shm");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("lists only active stakeholders", async () => {
    const legal = await createStakeholder(server, setup, "Legal");
    const archivable = await createStakeholder(server, setup, "Risk");
    await archive(archivable);

    const response = await server.fetch(stakeholdersUrl(), {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ListBody;
    expect(body.items.map((item) => item.id)).toEqual([legal.id]);
  });

  test("shows stakeholders and reports missing records", async () => {
    const legal = await createStakeholder(server, setup, "Legal");

    const shown = await server.fetch(`${stakeholdersUrl()}/${legal.id}`, {
      headers: { Cookie: setup.cookie }
    });
    expect(shown.status).toBe(200);
    expect((await shown.json()) as ShowBody).toMatchObject({
      stakeholder: { id: legal.id, name: "Legal", type: "INTERNAL" }
    });

    const missing = await server.fetch(`${stakeholdersUrl()}/missing-id`, {
      headers: { Cookie: setup.cookie }
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ title: "Stakeholder not found" });
  });

  test("patches stakeholders with partial updates", async () => {
    const legal = await createStakeholder(server, setup, "Legal");

    const response = await server.fetch(`${stakeholdersUrl()}/${legal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "Risk", type: "REGULATORY" })
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as ShowBody).toMatchObject({
      stakeholder: { id: legal.id, name: "Risk", type: "REGULATORY" }
    });

    const shown = await server.fetch(`${stakeholdersUrl()}/${legal.id}`, {
      headers: { Cookie: setup.cookie }
    });
    expect((await shown.json()) as ShowBody).toMatchObject({
      stakeholder: { name: "Risk", type: "REGULATORY" }
    });
  });

  test("rejects invalid patch payloads", async () => {
    const legal = await createStakeholder(server, setup, "Legal");

    const response = await server.fetch(`${stakeholdersUrl()}/${legal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid stakeholder update"
    });
  });

  test("reports missing stakeholders on patch", async () => {
    const response = await server.fetch(`${stakeholdersUrl()}/missing-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ description: "Updated" })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Stakeholder not found" });
  });

  test("archives stakeholders and removes them from the active list", async () => {
    const legal = await createStakeholder(server, setup, "Legal");

    const response = await archive(legal);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      archived: true,
      stakeholder: { id: legal.id }
    });

    const list = await server.fetch(stakeholdersUrl(), {
      headers: { Cookie: setup.cookie }
    });
    expect(((await list.json()) as ListBody).items).toEqual([]);
  });

  function stakeholdersUrl(): string {
    return `/v1/projects/${setup.projectId}/stakeholders`;
  }

  function archive(stakeholder: Stakeholder) {
    return server.fetch(`${stakeholdersUrl()}/${stakeholder.id}`, {
      method: "DELETE",
      headers: { Cookie: setup.cookie }
    });
  }
});
