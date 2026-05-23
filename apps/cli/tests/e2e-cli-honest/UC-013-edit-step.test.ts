import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { addMainStepViaCli, expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-013 honest CLI - Edit a use case step", () => {
  test("edits a step action with a base revision through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc013-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "EDT",
        runCli
      });
      const step = await addMainStepViaCli(seed, runCli);
      const edited = await expectOk(
        runCli(
          [
            "step",
            "edit",
            step.stepId,
            "--action",
            "Reviews the order.",
            "--base-revision",
            step.baseRevision
          ],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(edited.stdout).toContain("Reviews the order.");
      expect(edited.stdout).toContain("version 5");
    } finally {
      await server.stop();
    }
  }, 30_000);
});
