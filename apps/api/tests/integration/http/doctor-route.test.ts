import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  createUseCase,
  type ProjectSetup
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;

describe("GET /v1/doctor integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "Doctor Integration", "doctor-int", "doctor");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects anonymous usecase diagnostics through real routing", async () => {
    const actor = await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, actor.name, "Track shipment");

    const response = await server.fetch(`/v1/doctor?usecase=${usecase.key}`);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      title: "Not authorized to run doctor"
    });
  });
});
