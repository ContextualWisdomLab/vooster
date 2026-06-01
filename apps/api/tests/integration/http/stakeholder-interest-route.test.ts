import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/usecases/:usecaseId/stakeholder-interests integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed stakeholder interest requests through real routing", async () => {
    const response = await server.fetch(
      "/v1/usecases/usecase-1/stakeholder-interests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest: "", stakeholder: "Buyer" })
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid stakeholder interest request"
    });
  });
});
