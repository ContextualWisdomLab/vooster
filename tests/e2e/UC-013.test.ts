import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  createUseCaseWithMainStep,
  type RevisionResponse,
  type ScenarioStep
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type StepPatchResponse = {
  affected_sessions: string[];
  revision: RevisionResponse;
  step: ScenarioStep;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-013 - Edit a use case step", () => {
  test("MAIN: edit step action and append breaking revision", async () => {
    const { mainStep, mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(
        server,
        "Edit Step",
        "edit-step",
        "stub-edit-step"
      );

    const response = await server.fetch(`/v1/steps/${mainStep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        action: "Reviews the order.",
        base_revision: mainStepRevision.id
      })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as StepPatchResponse;
    expect(body.step).toMatchObject({
      action: "Reviews the order.",
      id: mainStep.id,
      scenario_id: mainStep.scenario_id,
      step_number: 1
    });
    expect(body.revision).toMatchObject({
      change_summary: `Edited step ${mainStep.id}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      severity: "BREAKING",
      version_number: 5
    });
    expect(body.affected_sessions).toEqual([]);
  });
});
