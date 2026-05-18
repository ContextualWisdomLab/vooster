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
type ProblemResponse = {
  current_revision_id?: string;
  revision_diff?: { base_revision: string; current_revision: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
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

  test("2a: stale base revision returns current revision and leaves step unchanged", async () => {
    const { mainStep, mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(
        server,
        "Stale Step",
        "stale-step",
        "stub-stale-step"
      );

    const stale = await server.fetch(`/v1/steps/${mainStep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        action: "Reviews the order.",
        base_revision: usecase.current_revision_id
      })
    });

    expect(stale.status).toBe(409);
    const problem = (await stale.json()) as ProblemResponse;
    expect(problem.title).toMatch(/base revision is stale/i);
    expect(problem.current_revision_id).toBe(mainStepRevision.id);
    expect(problem.revision_diff).toEqual({
      base_revision: usecase.current_revision_id,
      current_revision: mainStepRevision.id
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key}`,
      reason: "Inspect the current use case before retrying the step edit."
    });

    const valid = await server.fetch(`/v1/steps/${mainStep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        action: "Reviews the order.",
        base_revision: mainStepRevision.id
      })
    });
    const body = (await valid.json()) as StepPatchResponse;
    expect(body.step.action).toBe("Reviews the order.");
    expect(body.revision.version_number).toBe(5);
  });
});
