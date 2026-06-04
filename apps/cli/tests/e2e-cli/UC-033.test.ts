import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-033 CLI - Learn how to use vspec", () => {
  test("MAIN: fresh agent prints the public AI guide", async () => {
    const server = await startNetworkServer("vspec-cli-uc033-");
    try {
      const result = await runCli(["ai-guide", "--api-url", server.apiUrl]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("# vspec AI Agent Guide");
      expect(result.stdout).toContain("Why sessions exist");
      expect(result.stdout).toContain("Mandatory workflow");
      expect(result.stdout).toContain("The --format=agent payload contract");
      expect(result.stdout).toContain("Forbidden actions");
      expect(result.stdout).toContain("Greenfield setup");
      expect(result.stdout).toContain("If `vspec status` already shows an API");
      expect(result.stdout).toContain("vspec project create --key POCKET");
      expect(result.stdout).toContain("vspec init --project POCKET");
      expect(result.stdout).toContain(
        'vspec actor create --name "Pocket" --type SUPPORTING'
      );
      expect(result.stdout).toContain("vspec usecase add-stakeholder");
      expect(result.stdout).toContain("Existing use case edits");
      expect(result.stdout).toContain("`vspec step add` appends");
      expect(result.stdout).toContain(
        "vspec scenario add POCKET-001 --type EXTENSION --at 2a"
      );
      expect(result.stdout).toContain("Worked example");
      expect(result.stdout).toContain("vspec login");
      expect(result.stdout).toContain("vspec project list");
      expect(result.stdout).toContain("vspec session start");
    } finally {
      await server.stop();
    }
  });
});
