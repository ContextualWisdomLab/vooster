import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - goal edit", () => {
  test("rejects a goal through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-goal-edit-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "GLE",
        runCli
      });
      const created = await expectOk(
        runCli(
          [
            "goal",
            "create",
            "--project-id",
            seed.projectId,
            "--actor-id",
            seed.actorId,
            "--description",
            "Submit an order",
            "--level",
            "USER_GOAL",
            "--priority",
            "P1"
          ],
          seed.env
        )
      );
      const goalId = created.stdout.match(/Goal id ([^\s]+)/u)?.[1] ?? "";
      const rejected = await expectOk(runCli(["goal", "reject", goalId], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(rejected.stdout).toContain("REJECTED");
    } finally {
      await server.stop();
    }
  }, 30_000);
});
