import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - usecase write", () => {
  test("sets and restores a use case through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-usecase-write-");
    try {
      const seed = await seedViaCli({ apiUrl: server.apiUrl, projectKey: "UCW", runCli });
      await expectOk(runCli(["usecase", "archive", seed.usecaseKey], seed.env));
      const restored = await expectOk(runCli(["usecase", "restore", seed.usecaseKey], seed.env));
      const updated = await expectOk(runCli([
        "usecase",
        "set",
        seed.usecaseKey,
        "--field",
        "status",
        "--value",
        "DRAFT"
      ], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(restored.stdout).toContain("Restored");
      expect(updated.stdout).toContain("DRAFT");
    } finally {
      await server.stop();
    }
  }, 30_000);
});
