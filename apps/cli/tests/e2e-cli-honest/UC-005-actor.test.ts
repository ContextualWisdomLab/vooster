import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

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

      const secondActor = await expectOk(
        runCli(
          [
            "actor",
            "create",
            "--name",
            "Admin",
            "--type",
            "SUPPORTING",
            "--description",
            "Internal operator who reviews orders.",
            "--project-id",
            seed.projectId
          ],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(seed.actorId).toMatch(/[a-f0-9-]+/u);
      expect(secondActor.stdout).toContain("Admin");
      expect(secondActor.stdout).toContain("SUPPORTING");
    } finally {
      if (server) await server.stop();
    }
  }, 30_000);
});
