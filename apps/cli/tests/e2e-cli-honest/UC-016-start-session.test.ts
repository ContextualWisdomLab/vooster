import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
      const cwd = mkdtempSync(join(tmpdir(), "vspec-session-file-"));
      const session = await expectOk(
        runCli(
          [
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
          ],
          seed.env,
          { cwd }
        )
      );

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(session.stdout).toContain("Intent Implement checkout validation");
      expect(session.stdout).toContain("Pinned revisions 1");
      const sessionPath = join(cwd, ".vspec", "session.json");
      expect(existsSync(sessionPath)).toBe(true);
      const sessionFile = JSON.parse(readFileSync(sessionPath, "utf8")) as {
        pinned_revisions: Record<string, string>;
        session_id: string;
      };
      expect(sessionFile.session_id).toMatch(/[a-f0-9-]+/u);
      expect(Object.keys(sessionFile.pinned_revisions)).toHaveLength(1);
    } finally {
      if (server) await server.stop();
    }
  });
});
