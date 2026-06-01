import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/usecases/:id/export/gherkin integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed Gherkin export requests through real routing", async () => {
    const response = await server.fetch("/v1/usecases/usecase-1/export/gherkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: "yes" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid Gherkin export request"
    });
  });
});
