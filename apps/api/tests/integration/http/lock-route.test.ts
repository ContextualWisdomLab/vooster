import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/locks integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed lock payloads through real routing", async () => {
    const response = await server.fetch("/v1/locks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid lock request" });
  });
});
