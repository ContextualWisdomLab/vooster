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
});

function exportMarkdown(usecaseId: string, cookie: string, body: Record<string, unknown> = {}) {
  return server.fetch(`/v1/usecases/${usecaseId}/export/markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}
