import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("comment routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed comment add bodies through real routing", async () => {
    const response = await server.fetch("/v1/usecases/missing-usecase/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "empty_body" });
  });

  test("rejects malformed comment patch bodies through real routing", async () => {
    const response = await server.fetch("/v1/comments/comment-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: false })
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "empty_body" });
  });

  test("reports missing use cases when adding a comment through real routing", async () => {
    const response = await server.fetch("/v1/usecases/missing-usecase/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Needs review" })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
