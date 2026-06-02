import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/changes/preview integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed change proposals after marker detection through real routing", async () => {
    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch: {}, usecase_key: "PAY-001" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid change proposal" });
  });
});
