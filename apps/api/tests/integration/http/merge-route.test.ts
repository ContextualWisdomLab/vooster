import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/merges integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed open merge requests through real routing", async () => {
    const response = await server.fetch("/v1/merges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_branch_id: "" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid merge request" });
  });
});
