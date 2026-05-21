import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-019 honest CLI - Create a branch", () => {
  test("creates a human branch from main through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc019-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "BRC",
        runCli
      });
      const branch = await expectOk(runCli([
        "branch",
        "create",
        "feature/refund-review",
        "--from",
        "main",
        "--project-id",
        seed.projectId
      ], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(branch.stdout).toContain("Name feature/refund-review");
      expect(branch.stdout).toContain("Status ACTIVE");
    } finally {
      await server.stop();
    }
  });
});
