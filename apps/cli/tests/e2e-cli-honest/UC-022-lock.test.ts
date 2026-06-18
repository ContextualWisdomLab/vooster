import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-022 honest CLI - Lock a use case", () => {
  test("acquires a semantic lock through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc022-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "LCK",
        runCli
      });
      const lock = await expectOk(
        runCli(
          [
            "lock",
            seed.usecaseKey,
            "--type",
            "semantic",
            "--reason",
            "Agent is rewriting the success scenario.",
            "--ttl",
            "15",
            "--session",
            "session-main-lock"
          ],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(lock.stdout).toContain("Type SEMANTIC");
      expect(lock.stdout).toContain("Holder session-main-lock");
    } finally {
      if (server) await server.stop();
    }
  });
});
