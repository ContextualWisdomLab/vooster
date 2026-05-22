import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - project read", () => {
  test("lists projects through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-project-list-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "PRL",
        runCli
      });

      const listed = await expectOk(runCli(["project", "list"], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(listed.stdout).toContain(seed.projectKey);
      expect(listed.stdout).toContain(seed.projectId);
    } finally {
      await server.stop();
    }
  }, 30_000);
});
