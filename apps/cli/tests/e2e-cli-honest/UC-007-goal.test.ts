import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-007 honest CLI - Manage actor goals", () => {
  test("creates and lists a goal through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc007-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "GOL",
        runCli
      });
      const created = await expectOk(runCli([
        "goal",
        "create",
        "--project-id",
        seed.projectId,
        "--actor-id",
        seed.actorId,
        "--description",
        "Places an order",
        "--level",
        "USER_GOAL",
        "--priority",
        "P1"
      ], seed.env));
      const listed = await expectOk(runCli([
        "goal",
        "list",
        "--project-id",
        seed.projectId,
        "--actor-id",
        seed.actorId
      ], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(created.stdout).toContain("Places an order");
      expect(listed.stdout).toContain("Places an order");
    } finally {
      await server.stop();
    }
  });
});
