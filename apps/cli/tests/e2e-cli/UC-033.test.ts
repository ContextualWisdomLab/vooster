import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-033 CLI - Learn how to use vspec", () => {
  test("MAIN: fresh agent prints the public AI guide", async () => {
    const server = await startNetworkServer("vspec-cli-uc033-");
    try {
      const result = await runCli([
        "ai-guide",
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("# vspec AI Agent Guide");
      expect(result.stdout).toContain("Why sessions exist");
      expect(result.stdout).toContain("pin -> fetch via --format=agent -> propose-change -> commit");
      expect(result.stdout).toContain("The --format=agent payload contract");
      expect(result.stdout).toContain("Forbidden actions");
      expect(result.stdout).toContain("Worked example");
      expect(result.stdout).toContain("vspec login");
      expect(result.stdout).toContain("vspec project list");
      expect(result.stdout).toContain("vspec session start");
    } finally {
      await server.stop();
    }
  });
});
