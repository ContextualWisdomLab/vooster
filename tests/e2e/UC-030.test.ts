import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createExtensionScenario,
  createScenarioReadyUseCase,
  createUseCaseWithMainStep,
  type ScenarioResponse
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-030 - Export a use case to Gherkin", () => {
  test("MAIN: export main and extension scenarios as deterministic Gherkin", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Gherkin Main", "gherkin-main", "stub-gherkin-main");
    const extensionResponse = await createExtensionScenario(
      server,
      usecase.id,
      setup.cookie,
      { condition: "Payment is declined.", extension_point: "1a", outcome: "FAILURE" }
    );
    const extension = (await extensionResponse.json()) as ScenarioResponse;
    await addStep(server, extension.scenario.id, setup.cookie, {
      action: "Uses a backup card.",
      actor: "Customer"
    });

    const response = await server.fetch(`/v1/usecases/${usecase.id}/export/gherkin?format=feature`, {
      method: "POST",
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe(`Feature: Places an order

Background:
  Given the use case is in scope chk

Scenario: Main success
  When Customer Places an order.

Scenario: 1a Payment is declined.
  Given main success reaches step 1
  When Customer Uses a backup card.
  Then outcome is FAILURE
`);
  });

  test("3a: incomplete main success scenario returns doctor guidance", async () => {
    const { setup, usecase } =
      await createScenarioReadyUseCase(server, "Gherkin Empty", "gherkin-empty", "stub-gherkin-empty");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/export/gherkin?format=feature`, {
      method: "POST",
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as {
      missing_required_field: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
      title: string;
    };
    expect(problem.title).toMatch(/cannot export incomplete use case/i);
    expect(problem.missing_required_field).toBe("main_success.steps");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec doctor ${usecase.key}`,
      reason: "Inspect missing Gherkin export prerequisites."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec scenario add ${usecase.key} --type main-success`,
      reason: "Create the required main success scenario before export."
    });
  });

  test("6a: missing output directory returns local config guidance", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Gherkin Output", "gherkin-output", "stub-gherkin-output");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/export/gherkin?format=feature`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ output_path: "missing/CHK-001.feature" })
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as {
      exit_code: number;
      path: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
      title: string;
    };
    expect(problem.title).toMatch(/output directory is not writable/i);
    expect(problem.exit_code).toBe(6);
    expect(problem.path).toBe("missing/CHK-001.feature");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "mkdir -p missing",
      reason: "Create the export output directory."
    });
  });

  test("6b: existing output file requires force and returns diff summary", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Gherkin Exists", "gherkin-exists", "stub-gherkin-exists");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/export/gherkin?format=feature`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        existing_file_content: "Feature: Old checkout behavior\n",
        output_path: "tests/CHK-001.feature"
      })
    });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as {
      diff_summary: { existing_lines: number; path: string; proposed_lines: number };
      suggested_next_actions: Array<{ command: string; reason: string }>;
      title: string;
    };
    expect(problem.title).toMatch(/output file already exists/i);
    expect(problem.diff_summary).toEqual({
      existing_lines: 1,
      path: "tests/CHK-001.feature",
      proposed_lines: 7
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec export gherkin ${usecase.key} --force`,
      reason: "Overwrite the existing feature file intentionally."
    });
  });

  test("2a: stale requested revision returns history guidance", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Gherkin Revision", "gherkin-revision", "stub-gherkin-revision");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/export/gherkin?format=feature`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ revision_id: "missing-revision" })
    });

    expect(response.status).toBe(404);
    const problem = (await response.json()) as {
      revision_id: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
      title: string;
    };
    expect(problem.title).toMatch(/revision not found/i);
    expect(problem.revision_id).toBe("missing-revision");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key}`,
      reason: "Find an exportable revision for this use case."
    });
  });
});
