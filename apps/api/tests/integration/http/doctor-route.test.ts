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

  test("project visible count matches the default use case list scope", async () => {
    const actor = await createActor(server, setup, "Customer");
    const active = await createUseCase(
      server,
      setup,
      actor.name,
      "Reviews active case"
    );
    const archived = await createUseCase(
      server,
      setup,
      actor.name,
      "Reviews archived case"
    );
    await server.fetch(`/__test/usecases/${archived.id}/archive`, {
      method: "POST"
    });

    const doctorResponse = await server.fetch(
      `/v1/doctor?project_id=${setup.projectId}`,
      {
        headers: { Cookie: setup.cookie }
      }
    );
    const listResponse = await server.fetch(
      `/v1/projects/${setup.projectId}/usecases`,
      {
        headers: { Cookie: setup.cookie }
      }
    );

    const doctor = (await doctorResponse.json()) as DoctorBody;
    const list = (await listResponse.json()) as {
      items: Array<{ key: string }>;
    };
    expect(list.items.map((item) => item.key)).toEqual([active.key]);
    expect(doctor.checks).toContainEqual(
      expect.objectContaining({
        id: "project.usecases.visible",
        message: "1 use case(s) visible in this project."
      })
    );
  });

  test("project diagnostics roll up failing per-use-case checks", async () => {
    const actor = await createActor(server, setup, "Customer");
    const usecase = await createUseCase(
      server,
      setup,
      actor.name,
      "Reviews incomplete case"
    );

    const projectResponse = await server.fetch(
      `/v1/doctor?project_id=${setup.projectId}`,
      {
        headers: { Cookie: setup.cookie }
      }
    );
    const usecaseResponse = await server.fetch(`/v1/doctor?usecase=${usecase.key}`, {
      headers: { Cookie: setup.cookie }
    });

    const projectDoctor = (await projectResponse.json()) as DoctorBody;
    const usecaseDoctor = (await usecaseResponse.json()) as DoctorBody;
    expect(usecaseDoctor.status).toBe("issues_found");
    expect(projectDoctor.status).toBe("issues_found");
    const projectVerifyCheck = projectDoctor.checks.find(
      (check) => check.id === "project.usecases.verify"
    );
    if (projectVerifyCheck === undefined) {
      throw new Error("expected project use case verification check");
    }
    expect(projectVerifyCheck.status).toBe("fail");
    expect(projectVerifyCheck.message).toContain(usecase.key);
    expect(projectDoctor.suggested_next_actions).toContainEqual({
      command: `vspec doctor --usecase ${usecase.key}`,
      reason: "Inspect the failing use case quality checks."
    });
  });
});

type DoctorBody = {
  checks: Array<{ id: string; message: string; status: string }>;
  scope: { project_id: string };
  status: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
