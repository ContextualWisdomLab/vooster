import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-002 CLI - Log in", () => {
  test("MAIN: returning user gets a fresh session and workspace list", async () => {
    const server = await startNetworkServer("vspec-cli-uc002-");
    try {
      const signup = await runCli(
        [
          "login",
          "--workspace-name",
          "Returning Workspace",
          "--workspace-slug",
          "returning-workspace",
          "--api-url",
          server.apiUrl
        ],
        {
          VSPEC_AUTH_STUB: "1",
          VSPEC_AUTH_STUB_ID: "stub-cli-returning-user"
        }
      );
      expect(signup.status).toBe(0);

      const login = await runCli(["login", "--api-url", server.apiUrl], {
        VSPEC_AUTH_STUB: "1",
        VSPEC_AUTH_STUB_ID: "stub-cli-returning-user"
      });

      expect(login.stderr).toBe("");
      expect(login.status).toBe(0);
      expect(login.stdout).toContain("stub-cli-returning-user");
      expect(login.stdout).toContain("returning-workspace");
      expect(login.stdout).toContain("OWNER");
    } finally {
      await server.stop();
    }
  });
});
