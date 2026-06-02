import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/usecases/:id/export/markdown integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed export requests through real routing", async () => {
    const response = await server.fetch("/v1/usecases/usecase-1/export/markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: "yes" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid markdown export request"
    });
  });

  test("reports missing use cases through real routing", async () => {
    const response = await server.fetch("/v1/usecases/usecase-1/export/markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
