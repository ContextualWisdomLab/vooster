import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  createUseCase,
  type ProjectSetup,
  type UseCase
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;
let usecase: UseCase;

describe("PATCH /v1/usecases/:usecaseId integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(
      server,
      "Use Case Update",
      "usecase-update",
      "stub-ucu"
    );
    await createActor(server, setup, "Customer");
    usecase = await createUseCase(server, setup, "Customer", "Places an order");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("accepts documented metadata fields and persists them", async () => {
    const response = await server.fetch(`/v1/usecases/${usecase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        format: "BRIEF",
        level: "SUMMARY",
        priority: "P1",
        scope: "checkout-admin",
        status: "DRAFT",
        title: "Reviews checkout status"
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      usecase: {
        level: "SUMMARY",
        priority: "P1",
        scope: "checkout-admin",
        status: "DRAFT",
        title: "Reviews checkout status"
      }
    });

    const shown = await server.fetch(`/v1/usecases/${usecase.id}`, {
      headers: { Cookie: setup.cookie }
    });
    expect(await shown.json()).toMatchObject({
      usecase: {
        level: "SUMMARY",
        priority: "P1",
        scope: "checkout-admin",
        status: "DRAFT",
        title: "Reviews checkout status"
      }
    });
  });

  test("rejects malformed use case updates", async () => {
    const response = await server.fetch(`/v1/usecases/${usecase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ status: "UNKNOWN" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid use case update" });
  });
});
