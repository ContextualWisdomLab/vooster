import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("/v1/api-keys integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed API key create requests through real routing", async () => {
    const response = await server.fetch("/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", scopes: [], workspace_id: "workspace-1" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid API key request" });
  });

  test("rejects malformed API key list requests through real routing", async () => {
    const response = await server.fetch("/v1/api-keys", { method: "GET" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid API key list request"
    });
  });
});
