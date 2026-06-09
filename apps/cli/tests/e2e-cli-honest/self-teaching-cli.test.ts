import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - self-teaching guidance", () => {
  test("usecase authoring errors include server next actions and suggested titles", async () => {
    const server = await startNetworkServer("vspec-honest-self-teaching-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "TEA",
        runCli
      });
      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");

      const rejected = await runCli(
        [
          "usecase",
          "create",
          "--title",
          "Order status",
          "--primary-actor",
          "Customer",
          "--project-id",
          seed.projectId
        ],
        seed.env
      );

      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toBe("");
      expect(rejected.stdout).toContain("Use case title should be a verb phrase");
      expect(rejected.stdout).toContain("Suggested titles");
      expect(rejected.stdout).toContain("Review order status");
      expect(rejected.stdout).toContain("Next actions");
      expect(rejected.stdout).toContain("vspec usecase create --force");

      const forced = await expectOk(
        runCli(
          [
            "usecase",
            "create",
            "--title",
            "Order status",
            "--primary-actor",
            "Customer",
            "--project-id",
            seed.projectId,
            "--force"
          ],
          seed.env
        )
      );
      expect(forced.stdout).toContain("UseCase TEA-");
    } finally {
      await server.stop();
    }
  }, 30_000);

  test("actor create accepts the documented --human flag", async () => {
    const server = await startNetworkServer("vspec-honest-self-teaching-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "HUM",
        runCli
      });
      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");

      const actor = await expectOk(
        runCli(
          [
            "actor",
            "create",
            "--name",
            "Support Specialist",
            "--type",
            "SUPPORTING",
            "--description",
            "Helps customers recover orders.",
            "--project-id",
            seed.projectId,
            "--human"
          ],
          seed.env
        )
      );

      expect(actor.stdout).toContain("Actor Support Specialist");
    } finally {
      await server.stop();
    }
  }, 30_000);
});
