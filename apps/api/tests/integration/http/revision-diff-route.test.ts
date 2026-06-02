import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("GET /v1/usecases/:usecaseId/diff integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed diff requests through real routing", async () => {
    const response = await server.fetch(
      "/v1/usecases/missing-usecase/diff?from=rev-1&to="
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid diff request" });
  });

  test("reports missing use cases through real routing", async () => {
    const response = await server.fetch(
      "/v1/usecases/missing-usecase/diff?format=json&from=rev-1&to=rev-2"
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
