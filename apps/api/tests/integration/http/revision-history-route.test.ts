import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("GET /v1/usecases/:usecaseId/revisions integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed history requests through real routing", async () => {
    const response = await server.fetch("/v1/usecases/usecase-1/revisions?limit=0", {
      method: "GET"
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid history request" });
  });
});
