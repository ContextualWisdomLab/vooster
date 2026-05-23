import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/projects/:projectId/sync integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed pull requests through real routing", async () => {
    const response = await server.fetch("/v1/projects/project-1/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch: 1 })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid sync pull request"
    });
  });
});
