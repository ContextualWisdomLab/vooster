import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  createUseCase,
  type ProjectSetup
} from "../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type DoctorResponse = {
  checks: Array<{ id: string; status: "fail" | "pass" | "warning" }>;
  scope: { project_id: string; usecase?: { key: string } };
  status: "issues_found" | "ok";
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

let server: TestServer;
let setup: ProjectSetup;

describe("GET /v1/doctor", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(server, "Doctor", "doctor", "doctor-owner");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("returns a project diagnostic instead of 404", async () => {
    const response = await server.fetch(`/v1/doctor?project_id=${setup.projectId}`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as DoctorResponse;
    expect(body.status).toBe("ok");
    expect(body.scope.project_id).toBe(setup.projectId);
    expect(body.checks).toContainEqual(
      expect.objectContaining({ id: "project.exists", status: "pass" })
    );
  });

  test("returns use case quality checks and fix commands", async () => {
    const actor = await createActor(server, setup, "Customer");
    const usecase = await createUseCase(
      server,
      setup,
      actor.name,
      "Submit refund request"
    );

    const response = await server.fetch(`/v1/doctor?usecase=${usecase.key}`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as DoctorResponse;
    expect(body.status).toBe("issues_found");
    expect(body.scope.usecase?.key).toBe(usecase.key);
    expect(body.checks).toContainEqual(
      expect.objectContaining({
        id: "stakeholder_interests.present",
        status: "fail"
      })
    );
    expect(body.checks).toContainEqual(
      expect.objectContaining({ id: "main_success.present", status: "fail" })
    );
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec stakeholder interest add ${usecase.key}`,
      reason: "Add at least one Cockburn stakeholder interest."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec scenario add ${usecase.key} --type main-success`,
      reason: "Add the main success scenario before export."
    });
  });
});
