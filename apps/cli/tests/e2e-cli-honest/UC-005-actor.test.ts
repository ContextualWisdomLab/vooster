import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { seedViaCli } from "./cli-setup.js";

describe("UC-005 honest CLI - Define an actor", () => {
  test("creates an actor through the CLI with isolated config", async () => {
    const server = await startNetworkServer("vspec-honest-uc005-");
    try {
      const seed = await seedViaCli({
        actorName: "Customer",
        apiUrl: server.apiUrl,
        projectKey: "ACT",
        runCli
      });

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(seed.actorId).toMatch(/[a-f0-9-]+/u);
    } finally {
      await server.stop();
    }
  });
});
