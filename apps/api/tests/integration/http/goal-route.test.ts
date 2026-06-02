import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("goal routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed goal create requests through real routing", async () => {
    const response = await server.fetch("/v1/projects/project-1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor_id: "", priority: "P1" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid goal request" });
  });

  test("rejects malformed goal update requests through real routing", async () => {
    const response = await server.fetch("/v1/goals/goal-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "UNKNOWN" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid goal update" });
  });
});
