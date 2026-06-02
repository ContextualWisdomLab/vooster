import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("scenario routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed scenario create requests through real routing", async () => {
    const response = await server.fetch("/v1/usecases/missing-usecase/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "SIDE_QUEST" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid scenario request" });
  });

  test("rejects malformed step requests through real routing", async () => {
    const response = await server.fetch("/v1/scenarios/scenario-1/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "Pay invoice", actor: "" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid step request" });
  });

  test("rejects empty step actions through real routing", async () => {
    const response = await server.fetch("/v1/scenarios/scenario-1/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "   ", actor: "Customer" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Step action is required" });
  });

  test("reports missing use cases when creating a main success scenario", async () => {
    const response = await server.fetch("/v1/usecases/missing-usecase/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "MAIN_SUCCESS" })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });

  test("reports missing use cases when creating an extension scenario", async () => {
    const response = await server.fetch("/v1/usecases/missing-usecase/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "EXTENSION" })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
