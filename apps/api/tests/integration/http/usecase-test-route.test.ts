import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /__test/usecases/:usecaseId/archive integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("reports missing use cases when archiving through real routing", async () => {
    const response = await server.fetch("/__test/usecases/missing-usecase/archive", {
      method: "POST"
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
