import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/projects/:projectId/actors integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed actor create requests through real routing", async () => {
    const response = await server.fetch("/v1/projects/project-1/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_human: true, name: "", type: "PRIMARY" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid actor request" });
  });

  test("rejects invalid actor types through real routing", async () => {
    const response = await server.fetch("/v1/projects/project-1/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_human: true, name: "Customer", type: "UNKNOWN" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid actor type" });
  });

  test("reports access problems when creating without access", async () => {
    const response = await server.fetch("/v1/projects/project-1/actors?dry_run=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_human: true, name: "Customer", type: "PRIMARY" })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      title: "Contact the workspace owner for access"
    });
  });
});
