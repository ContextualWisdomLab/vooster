import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - stakeholder read", () => {
  test("lists and shows stakeholders through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-stakeholder-read-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "SHR",
        runCli
      });
      const created = await expectOk(
        runCli(
          [
            "stakeholder",
            "create",
            "--project-id",
            seed.projectId,
            "--name",
            "Product Manager",
            "--type",
            "INTERNAL"
          ],
          seed.env
        )
      );
      const stakeholderId = created.stdout.match(/Stakeholder id ([^\s]+)/u)?.[1] ?? "";
      const listed = await expectOk(
        runCli(["stakeholder", "list", "--project-id", seed.projectId], seed.env)
      );
      const shown = await expectOk(
        runCli(
          ["stakeholder", "show", stakeholderId, "--project-id", seed.projectId],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(listed.stdout).toContain("Product Manager");
      expect(shown.stdout).toContain(stakeholderId);
    } finally {
      await server.stop();
    }
  }, 30_000);
});
