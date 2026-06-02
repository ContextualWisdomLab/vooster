import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { signup } from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let session: { cookie: string; workspaceId: string };

type ProblemBody = { title: string };
type ListBody = { items: Array<{ id: string; key: string }> };
type CreateBody = {
  project: { id: string; key: string; name: string; workspace_id: string };
};

function createInDefaultWorkspace(body: Record<string, unknown>, query = "") {
  return server.fetch(`/v1/projects${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: session.cookie },
    body: JSON.stringify(body)
  });
}

async function listProjects(): Promise<ListBody> {
  const response = await server.fetch("/v1/projects", {
    headers: { Cookie: session.cookie }
  });
  return (await response.json()) as ListBody;
}

describe("project routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
    session = await signup(server, "Project Routes", "project-routes", "stub-proj");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("requires authentication before list and default create", async () => {
    const list = await server.fetch("/v1/projects");
    const create = await server.fetch("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "OPS", name: "Ops", visibility: "PRIVATE" })
    });

    expect(list.status).toBe(401);
    expect((await list.json()) as ProblemBody).toMatchObject({
      title: "Sign in to list projects"
    });
    expect(create.status).toBe(401);
    expect((await create.json()) as ProblemBody).toMatchObject({
      title: "Sign in to create a project"
    });
  });

  test("lists member projects sorted by key", async () => {
    await createInDefaultWorkspace({ key: "OPS", name: "Ops", visibility: "PRIVATE" });
    await createInDefaultWorkspace({
      key: "BILL",
      name: "Billing",
      visibility: "PRIVATE"
    });

    const body = await listProjects();
    expect(body.items.map((item) => item.key)).toEqual(["BILL", "OPS"]);
  });

  test.each([
    ["/v1/projects", { name: "Ops" }, "Invalid project request"],
    ["/v1/projects", { key: "bad", name: "Ops" }, "Invalid project key"]
  ] as Array<[string, Record<string, unknown>, string]>)(
    "rejects invalid create requests on %s",
    async (url, payload, title) => {
      const response = await server.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: session.cookie },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
      expect((await response.json()) as ProblemBody).toMatchObject({ title });
    }
  );

  test.each([
    [{ name: "Ops" }, "Invalid project request"],
    [{ key: "bad", name: "Ops" }, "Invalid project key"]
  ] as Array<[Record<string, unknown>, string]>)(
    "rejects invalid explicit-workspace create requests",
    async (payload, title) => {
      const response = await server.fetch(
        `/v1/workspaces/${session.workspaceId}/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: session.cookie },
          body: JSON.stringify(payload)
        }
      );

      expect(response.status).toBe(400);
      expect((await response.json()) as ProblemBody).toMatchObject({ title });
    }
  );

  test("creates projects in the default workspace and honors dry runs", async () => {
    const response = await createInDefaultWorkspace(
      { key: "OPS", name: "Ops", visibility: "PRIVATE" },
      "?dry_run=true"
    );

    expect(response.status).toBe(201);
    expect((await response.json()) as CreateBody).toMatchObject({
      project: { key: "OPS" }
    });

    const body = await listProjects();
    expect(body.items).toEqual([]);
  });

  test("creates projects in an explicit workspace and lists them", async () => {
    const response = await server.fetch(
      `/v1/workspaces/${session.workspaceId}/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: session.cookie },
        body: JSON.stringify({ key: "OPS", name: "Ops", visibility: "PRIVATE" })
      }
    );

    expect(response.status).toBe(201);
    expect((await response.json()) as CreateBody).toMatchObject({
      project: { key: "OPS", workspace_id: session.workspaceId }
    });

    const body = await listProjects();
    expect(body.items.map((item) => item.key)).toEqual(["OPS"]);
  });

  test("rejects unauthenticated and malformed project mutations", async () => {
    const created = await createInDefaultWorkspace({
      key: "OPS",
      name: "Ops",
      visibility: "PRIVATE"
    });
    const project = ((await created.json()) as CreateBody).project;

    const renameAuth = await server.fetch(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Billing" })
    });
    const renameBody = await server.fetch(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: session.cookie },
      body: JSON.stringify({ name: "" })
    });
    const deleteAuth = await server.fetch(`/v1/projects/${project.id}`, {
      method: "DELETE"
    });

    expect(renameAuth.status).toBe(401);
    expect((await renameAuth.json()) as ProblemBody).toMatchObject({
      title: "Sign in to rename a project"
    });
    expect(renameBody.status).toBe(400);
    expect((await renameBody.json()) as ProblemBody).toMatchObject({
      title: "Invalid rename request"
    });
    expect(deleteAuth.status).toBe(401);
    expect((await deleteAuth.json()) as ProblemBody).toMatchObject({
      title: "Sign in to delete a project"
    });
  });

  test("renames, deletes, and archives through routed parameters", async () => {
    const created = await createInDefaultWorkspace({
      key: "OPS",
      name: "Ops",
      visibility: "PRIVATE"
    });
    const project = ((await created.json()) as CreateBody).project;

    const renamed = await server.fetch(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: session.cookie },
      body: JSON.stringify({ name: "Billing" })
    });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()) as CreateBody).toMatchObject({
      project: { id: project.id, name: "Billing" }
    });

    const deleted = await server.fetch(`/v1/projects/${project.id}`, {
      method: "DELETE",
      headers: { Cookie: session.cookie }
    });
    expect(deleted.status).toBe(204);

    const afterDelete = await listProjects();
    expect(afterDelete.items).toEqual([]);

    const archived = await server.fetch(
      `/__test/workspaces/${session.workspaceId}/archive`,
      { method: "POST" }
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()) as { archived: boolean }).toEqual({
      archived: true
    });
  });
});
