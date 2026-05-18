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
  suggested_action?: string;
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

  test("3a: invalid action edits require correction or force", async () => {
    const { mainStep, mainStepRevision, setup } = await createUseCaseWithMainStep(
      server,
      "Invalid Step Edit",
      "invalid-step-edit",
      "stub-invalid-step-edit"
    );

    const empty = await patchStep(mainStep.id, setup.cookie, {
      action: "",
      base_revision: mainStepRevision.id
    });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as ProblemResponse).title).toMatch(/step action is required/i);

    const passive = await patchStep(mainStep.id, setup.cookie, {
      action: "Order is processed.",
      base_revision: mainStepRevision.id
    });
    expect(passive.status).toBe(422);
    const problem = (await passive.json()) as ProblemResponse;
    expect(problem.title).toMatch(/passive voice/i);
    expect(problem.suggested_action).toBe("Processed the order.");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec step edit --force",
      reason: "Persist this wording after reviewing the passive voice warning."
    });

    const forced = await patchStep(mainStep.id, setup.cookie, {
      action: "Order is processed.",
      base_revision: mainStepRevision.id,
      force: true
    });
    const body = (await forced.json()) as StepPatchResponse;
    expect(body.step.action).toBe("Order is processed.");
    expect(body.revision).toMatchObject({
      severity: "BREAKING",
      version_number: 5
    });
  });
});

async function patchStep(
  stepId: string,
  cookie: string,
  body: { action: string; base_revision: string; force?: boolean }
) {
  return server.fetch(`/v1/steps/${stepId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}
