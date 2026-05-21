import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { seedViaCli } from "./cli-setup.js";

describe("UC-004 honest CLI - Create a project", () => {
  test("creates a project through the CLI with isolated config", async () => {
    const server = await startNetworkServer("vspec-honest-uc004-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "PRJ",
        projectName: "Project Honest",
        runCli
      });

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(seed.projectId).toMatch(/[a-f0-9-]+/u);
      expect(seed.projectKey).toBe("PRJ");
    } finally {
      await server.stop();
    }
  });
});
