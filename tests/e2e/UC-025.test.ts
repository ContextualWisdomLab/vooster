import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createUseCaseWithMainStep,
  type StepResponse
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type DiffResponse = {
  changes: Array<{
    change_type: string;
    entity_type: string;
    path: string;
    revision: string;
    severity: string;
  }>;
  format: string;
  from_revision: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  summary: { breaking: number; cosmetic: number; non_breaking: number };
  to_revision: string;
  usecase: { id: string; key: string };
};
type DiffProblem = {
  diff?: unknown;
  missing_revision?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
  usecase?: { id: string; key: string };
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-025 - Compare two revisions of a use case", () => {
  test("MAIN: compare revisions as a structured JSON diff", async () => {
    const { mainStepRevision, scenario, setup, usecase } =
      await createUseCaseWithMainStep(server, "Diff Main", "diff-main", "stub-diff-main");
    const stepResponse = await addStep(server, scenario.scenario.id, setup.cookie, {
      action: "Confirms order.",
      actor: "Customer"
    });
    const secondStep = (await stepResponse.json()) as StepResponse;

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}/diff?from=${mainStepRevision.id}&to=${secondStep.revision.id}&format=json`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as DiffResponse;
    expect(body.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(body.format).toBe("json");
    expect(body.from_revision).toBe(mainStepRevision.id);
    expect(body.to_revision).toBe(secondStep.revision.id);
    expect(body.summary).toEqual({ breaking: 0, cosmetic: 0, non_breaking: 1 });
    expect(body.changes).toEqual([
      {
        change_type: "ADD",
        entity_type: "STEP",
        path: "main_success.steps[2]",
        revision: secondStep.revision.id,
        severity: "NON_BREAKING"
      }
    ]);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec revert ${usecase.key} --to ${mainStepRevision.id}`,
      reason: "Restore the earlier revision if this change is not wanted."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec impact ${usecase.key}`,
      reason: "Check dependent work before approving the change."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec merge open",
      reason: "Open a merge request when the diff is acceptable."
    });
  });

  test("2a: missing revision returns history guidance", async () => {
    const { mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(server, "Diff Missing", "diff-missing", "stub-diff-missing");

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}/diff?from=rev-missing&to=${mainStepRevision.id}&format=json`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(404);
    const problem = (await response.json()) as DiffProblem;
    expect(problem.title).toMatch(/revision not found/i);
    expect(problem.missing_revision).toBe("rev-missing");
    expect(problem.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(problem.diff).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key}`,
      reason: "Find valid revision IDs for this use case."
    });
  });
});
