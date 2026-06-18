import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { addMainScenarioViaCli, expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-011 honest CLI - Write the main success scenario", () => {
  test("creates the main scenario and appends a step through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc011-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "SCN",
        runCli
      });
      const scenarioId = await addMainScenarioViaCli(seed, runCli);
      const step = await expectOk(
        runCli(
          [
            "step",
            "add",
            scenarioId,
            "--actor",
            "Customer",
            "--action",
            "Places an order."
          ],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(scenarioId).toMatch(/[a-f0-9-]+/u);
      expect(step.stdout).toContain("1. Customer Places an order.");
    } finally {
      if (server) await server.stop();
    }
  }, 30_000);
});
