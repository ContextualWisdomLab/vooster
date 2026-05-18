import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addStep,
  createExtensionScenario,
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
});
