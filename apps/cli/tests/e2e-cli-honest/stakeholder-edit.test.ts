import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - stakeholder edit", () => {
  test("edits and archives a stakeholder through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-stakeholder-edit-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "SHE",
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
      const edited = await expectOk(
        runCli(
          [
            "stakeholder",
            "edit",
            stakeholderId,
            "--project-id",
            seed.projectId,
            "--name",
            "Product Owner"
          ],
          seed.env
        )
      );
      const archived = await expectOk(
        runCli(
          ["stakeholder", "archive", stakeholderId, "--project-id", seed.projectId],
          seed.env
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(edited.stdout).toContain("Product Owner");
      expect(archived.stdout).toContain(stakeholderId);
    } finally {
      if (server) await server.stop();
    }
  }, 30_000);
});
