import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { seedViaCli } from "./cli-setup.js";

describe("UC-009 honest CLI - Author a use case", () => {
  test("creates a draft use case through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc009-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "USC",
        runCli,
        usecaseTitle: "Places an order"
      });

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(seed.usecaseKey).toBe("USC-001");
    } finally {
      await server.stop();
    }
  });
});
