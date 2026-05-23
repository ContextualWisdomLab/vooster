import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - goal read", () => {
  test("shows a goal through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-goal-read-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "GLR",
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
      const shown = await expectOk(runCli(["goal", "show", goalId], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(shown.stdout).toContain("Submit an order");
    } finally {
      await server.stop();
    }
  }, 30_000);
});
