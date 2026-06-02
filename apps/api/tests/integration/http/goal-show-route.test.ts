import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("GET /v1/goals/:goalId integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("returns not found when the goal does not exist through real routing", async () => {
    const response = await server.fetch("/v1/goals/goal-1");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Goal not found" });
  });
});
