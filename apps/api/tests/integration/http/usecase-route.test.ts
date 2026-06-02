import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  type ProjectSetup
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;

describe("POST /v1/projects/:projectId/usecases integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "Use Case Routes", "usecase-routes", "stub-uc");
    await createActor(server, setup, "Customer");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("creates use cases when the query string is absent", async () => {
    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ primary_actor: "Customer", title: "Places an order" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      usecase: { id: string; key: string; title: string };
    };
    expect(body.usecase).toMatchObject({ key: "CHK-001", title: "Places an order" });

    const shown = await server.fetch(`/v1/usecases/${body.usecase.id}`, {
      headers: { Cookie: setup.cookie }
    });
    expect(shown.status).toBe(200);
    expect((await shown.json()) as unknown).toMatchObject({
      usecase: { key: "CHK-001", title: "Places an order" }
    });
  });

  test("rejects malformed use case requests", async () => {
    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ primary_actor: "Customer" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid use case request" });
  });

  test("rejects invalid use case enum values with field guidance", async () => {
    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        primary_actor: "Customer",
        priority: "P9",
        title: "Creates an order"
      })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      allowed_values: ["P0", "P1", "P2", "P3"],
      code: "SCHEMA_INVALID",
      field: "priority",
      title: "Invalid use case request"
    });
  });

  test("rejects use case creation without membership", async () => {
    const response = await server.fetch(`/v1/projects/${setup.projectId}/usecases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_actor: "Customer", title: "Places an order" })
    });

    expect(response.status).toBe(403);
  });
});
