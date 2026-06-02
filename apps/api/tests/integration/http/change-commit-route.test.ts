import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("change commit routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed commit requests through real routing", async () => {
    const response = await server.fetch("/v1/changes/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Every commit must reference a still-valid preview"
    });
  });

  test("rejects expire requests for unknown previews through real routing", async () => {
    const response = await server.fetch(
      "/__test/changes/previews/preview-missing/expire",
      { method: "POST" }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Change preview not found" });
  });
});
