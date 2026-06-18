import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - actor edit", () => {
  test("edits and archives an actor through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-actor-edit-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "ACE",
        runCli
      });
      const edited = await expectOk(
        runCli(
          [
            "actor",
            "edit",
            seed.actorId,
            "--project-id",
            seed.projectId,
            "--name",
            "Buyer"
          ],
          seed.env
        )
      );
      const archived = await expectOk(
        runCli(
          ["actor", "archive", seed.actorId, "--project-id", seed.projectId],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(edited.stdout).toContain("Buyer");
      expect(archived.stdout).toContain(seed.actorId);
    } finally {
      if (server) await server.stop();
    }
  }, 30_000);
});
