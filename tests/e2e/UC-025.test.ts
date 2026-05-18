import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createUseCaseWithMainStep,
  type StepResponse
} from "../helpers/scenario-fixtures.js";
import {
  advanceBranch,
  advanceMain,
  createBranch,
  projectUseCase
} from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type DiffResponse = {
  changes: Array<{
    change_type: string;
    entity_type: string;
    path: string;
    revision: string;
    severity: string;
    source_branch?: string;
  }>;
  cross_branch?: boolean;
  format: string;
  from_revision: string;
  note?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  summary: { breaking: number; cosmetic: number; non_breaking: number };
  to_revision: string;
  usecase: { id: string; key: string };
  warnings?: Array<{ from_branch: string; to_branch: string; type: string }>;
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

  test("3a: cross-branch diff returns warning and branch labels", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Diff Cross Branch", "diff-cross-branch", "stub-diff-cross");
    const branch = await createBranch(server, setup, "feature/diff-cross");
    const branchRevision = await advanceBranch(
      server,
      setup,
      branch.id,
      usecase.id,
      "Reviews a refund quickly"
    );
    const mainRevision = await advanceMain(server, setup, usecase.id, "Reviews a refund manually");

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}/diff?from=${branchRevision.revision_id}&to=${mainRevision.revision_id}&format=json`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as DiffResponse;
    expect(body.cross_branch).toBe(true);
    expect(body.warnings).toContainEqual({
      from_branch: "feature/diff-cross",
      to_branch: "main",
      type: "CROSS_BRANCH_DIFF"
    });
    expect(body.summary).toEqual({ breaking: 1, cosmetic: 0, non_breaking: 0 });
    expect(body.changes).toContainEqual({
      change_type: "CHANGE",
      entity_type: "USECASE",
      path: "usecase.title",
      revision: mainRevision.revision_id,
      severity: "BREAKING",
      source_branch: "main"
    });
  });

  test("4a: identical revisions return empty diff with byte match note", async () => {
    const { mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(server, "Diff Identical", "diff-identical", "stub-diff-same");

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}/diff?from=${mainStepRevision.id}&to=${mainStepRevision.id}&format=human`,
      { headers: { Cookie: setup.cookie } }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as DiffResponse;
    expect(body.format).toBe("human");
    expect(body.changes).toEqual([]);
    expect(body.summary).toEqual({ breaking: 0, cosmetic: 0, non_breaking: 0 });
    expect(body.note).toBe("Revisions match byte-for-byte.");
  });

  test("*a: non-member cannot compare revisions", async () => {
    const mine = await createUseCaseWithMainStep(server, "Diff Mine", "diff-mine", "stub-diff-mine");
    const other = await createUseCaseWithMainStep(
      server,
      "Diff Other",
      "diff-other",
      "stub-diff-other"
    );

    const response = await server.fetch(
      `/v1/usecases/${other.usecase.id}/diff?from=${other.usecase.current_revision_id}&to=${other.mainStepRevision.id}&format=json`,
      { headers: { Cookie: mine.setup.cookie } }
    );

    expect(response.status).toBe(403);
    const problem = (await response.json()) as DiffProblem;
    expect(problem.title).toMatch(/not authorized/i);
    expect(problem.diff).toBeUndefined();
    expect(problem.usecase).toBeUndefined();
    expect(problem.missing_revision).toBeUndefined();
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Authenticate with an account that has project access."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member set-role",
      reason: "Ask a workspace owner for read access."
    });
  });
});
