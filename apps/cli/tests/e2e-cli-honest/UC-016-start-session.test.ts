import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("UC-016 honest CLI - Start a work session", () => {
  test("starts a session pinned to a use case through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-uc016-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "SES",
        runCli
      });
      const session = await expectOk(runCli([
        "session",
        "start",
        "--intent",
        "Implement checkout validation",
        "--pin",
        seed.usecaseKey,
        "--agent-type",
        "CODEX",
        "--project-id",
        seed.projectId
      ], seed.env));

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(session.stdout).toContain("Intent Implement checkout validation");
      expect(session.stdout).toContain("Pinned revisions 1");
    } finally {
      await server.stop();
    }
  });
});
