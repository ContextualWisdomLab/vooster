import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - actor read", () => {
  test("lists and shows actors through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-actor-read-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "ACR",
        runCli
      });

      const listed = await expectOk(
        runCli(["actor", "list", "--project-id", seed.projectId], seed.env)
      );
      const shown = await expectOk(
        runCli(
          ["actor", "show", seed.actorId, "--project-id", seed.projectId],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(listed.stdout).toContain(seed.actorId);
      expect(shown.stdout).toContain(seed.actorId);
    } finally {
      await server.stop();
    }
  }, 30_000);
});
