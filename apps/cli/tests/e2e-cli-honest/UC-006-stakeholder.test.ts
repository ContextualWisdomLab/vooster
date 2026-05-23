import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-006 honest CLI - Define a stakeholder", () => {
  test("creates a stakeholder through the CLI with isolated config", async () => {
    const server = await startNetworkServer("vspec-honest-uc006-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "STK",
        runCli
      });
      const stakeholder = await expectOk(
        runCli(
          [
            "stakeholder",
            "create",
            "--project-id",
            seed.projectId,
            "--name",
            "Product Manager",
            "--type",
            "INTERNAL",
            "--description",
            "Owns checkout revenue."
          ],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(stakeholder.stdout).toContain("Product Manager");
      expect(stakeholder.stdout).toContain("INTERNAL");
    } finally {
      await server.stop();
    }
  });
});
