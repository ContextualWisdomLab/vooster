import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - usecase write", () => {
  test("sets and restores a use case through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-usecase-write-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "UCW",
        runCli
      });
      await expectOk(runCli(["usecase", "archive", seed.usecaseKey], seed.env));
      const restored = await expectOk(
        runCli(["usecase", "restore", seed.usecaseKey], seed.env)
      );
      const updated = await expectOk(
        runCli(
          ["usecase", "set", seed.usecaseKey, "--field", "status", "--value", "DRAFT"],
          seed.env
        )
      );
      const retitled = await expectOk(
        runCli(
          [
            "usecase",
            "set",
            seed.usecaseKey,
            "--field",
            "title",
            "--value",
            "Reviews checkout status"
          ],
          seed.env
        )
      );
      const releveled = await expectOk(
        runCli(
          ["usecase", "set", "--field", "level", "--value", "SUMMARY", seed.usecaseKey],
          seed.env
        )
      );
      const agentRetitled = await expectOk(
        runCli(
          [
            "usecase",
            "set",
            seed.usecaseKey,
            "--field",
            "title",
            "--value",
            "Reviews checkout status again",
            "--format=agent"
          ],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(restored.stdout).toContain("Restored");
      expect(updated.stdout).toContain("DRAFT");
      expect(retitled.stdout).toContain("Reviews checkout status");
      expect(releveled.stdout).toContain("Level SUMMARY");
      const envelope = JSON.parse(agentRetitled.stdout) as {
        data: { usecase: { title: string } };
        format_version: number;
      };
      expect(envelope.format_version).toBe(1);
      expect(envelope.data.usecase.title).toBe("Reviews checkout status again");
    } finally {
      await server.stop();
    }
  }, 30_000);
});
