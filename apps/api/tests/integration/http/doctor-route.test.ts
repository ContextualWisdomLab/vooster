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

  test("validates diagnostic scope through real routing", async () => {
    for (const query of ["", `?project_id=${setup.projectId}&usecase=missing`]) {
      const response = await server.fetch(`/v1/doctor${query}`, {
        headers: { Cookie: setup.cookie }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        title: "Provide exactly one of project_id or usecase"
      });
    }
  });

  test("returns project diagnostics for members through real routing", async () => {
    const response = await server.fetch(`/v1/doctor?project_id=${setup.projectId}`, {
      headers: { Cookie: setup.cookie }
    });

    const body = (await response.json()) as DoctorBody;
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.scope.project_id).toBe(setup.projectId);
    expect(body.checks).toContainEqual(
      expect.objectContaining({ id: "project.usecases.visible", status: "pass" })
    );
  });
});

type DoctorBody = {
  checks: Array<{ id: string; status: string }>;
  scope: { project_id: string };
  status: string;
};
