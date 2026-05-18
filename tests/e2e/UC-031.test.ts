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

describe("UC-031 - Export a use case to markdown", () => {
  test("MAIN: export canonical markdown with frontmatter, sections, and scenarios", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Markdown Main", "markdown-main", "stub-markdown-main");
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

    const response = await exportMarkdown(usecase.id, setup.cookie);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const markdown = await response.text();
    expect(markdown).toMatch(/revision: [0-9a-f-]{36}/);
    expect(markdown).toContain("## Stakeholders and Interests\n\n- **Product Manager**: Checkout revenue is protected.");
    expect(markdown).toContain("## Main Success Scenario\n\n1. **Customer** Places an order.");
    expect(markdown).toContain("### 1a. Payment is declined.\n\n- 1a1. **Customer** Uses a backup card.");
    expect(markdown).toMatch(/## Notes\n$/);
  });

  test("4a: incomplete use case returns doctor guidance", async () => {
    const { setup, usecase } =
      await createScenarioReadyUseCase(server, "Markdown Incomplete", "markdown-incomplete", "stub-markdown-incomplete");

    const response = await exportMarkdown(usecase.id, setup.cookie);

    expect(response.status).toBe(422);
    const problem = (await response.json()) as {
      missing_required_field: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
    };
    expect(problem.missing_required_field).toBe("main_success.steps");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec doctor ${usecase.key}`,
      reason: "Inspect missing markdown export prerequisites."
    });
  });

  test("6a: existing output requires force and returns proposed diff", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Markdown Exists", "markdown-exists", "stub-markdown-exists");

    const response = await exportMarkdown(usecase.id, setup.cookie, {
      existing_file_content: "# Old checkout\n",
      output_path: "specs/usecases/CHK-001.md"
    });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as {
      diff: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
    };
    expect(problem.diff).toContain("-# Old checkout");
    expect(problem.diff).toContain("+# Places an order");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec export markdown --force",
      reason: "Overwrite the existing markdown file after reviewing the diff."
    });
  });

  test("6b: unwritable output directory returns local config guidance", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Markdown Output", "markdown-output", "stub-markdown-output");

    const response = await exportMarkdown(usecase.id, setup.cookie, {
      output_path: "missing/CHK-001.md"
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as {
      exit_code: number;
      path: string;
      suggested_next_actions: Array<{ command: string; reason: string }>;
    };
    expect(problem.exit_code).toBe(6);
    expect(problem.path).toBe("missing/CHK-001.md");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "mkdir -p missing",
      reason: "Create the export output directory."
    });
  });

  test("5a: extensions with shared parent are sorted before any-step extensions", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Markdown Sort", "markdown-sort", "stub-markdown-sort");
    await addExtensionStep(usecase.id, setup.cookie, "1b", "Address is incomplete.", "Adds an address.");
    await addExtensionStep(usecase.id, setup.cookie, "*a", "Network is unavailable.", "Retries later.");
    await addExtensionStep(usecase.id, setup.cookie, "1a", "Payment is declined.", "Uses a backup card.");

    const response = await exportMarkdown(usecase.id, setup.cookie);
    const markdown = await response.text();
    const oneA = markdown.indexOf("### 1a. Payment is declined.");
    const oneB = markdown.indexOf("### 1b. Address is incomplete.");
    const starA = markdown.indexOf("### *a. Network is unavailable.");

    expect(response.headers.get("x-vspec-round-trip-self-check")).toBe("passed");
    expect(oneA).toBeGreaterThan(-1);
    expect(oneA).toBeLessThan(oneB);
    expect(oneB).toBeLessThan(starA);
  });
});

async function addExtensionStep(
  usecaseId: string,
  cookie: string,
  extension_point: string,
  condition: string,
  action: string
) {
  const response = await createExtensionScenario(
    server,
    usecaseId,
    cookie,
    { condition, extension_point, outcome: "FAILURE" }
  );
  const extension = (await response.json()) as ScenarioResponse;
  await addStep(server, extension.scenario.id, cookie, { action, actor: "Customer" });
}

function exportMarkdown(usecaseId: string, cookie: string, body: Record<string, unknown> = {}) {
  return server.fetch(`/v1/usecases/${usecaseId}/export/markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}
