import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-001 CLI - Sign up for a workspace", () => {
  test("MAIN: login creates a workspace and prints the next command", async () => {
    const server = await startNetworkServer("vspec-cli-uc001-");
    try {
      const result = await runCli(
        [
          "login",
          "--workspace-name",
          "CLI Workspace",
          "--workspace-slug",
          "cli-workspace",
          "--api-url",
          server.apiUrl
        ],
        {
          VSPEC_AUTH_STUB: "1",
          VSPEC_AUTH_STUB_ID: "stub-cli-user"
        }
      );

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("cli-workspace");
      expect(result.stdout).toContain("stub-cli-user@users.noreply.github.com");
      expect(result.stdout).toContain("vspec project create");
    } finally {
      await server.stop();
    }
  });
});
