import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli } from "./cli-setup.js";

describe("honest CLI - project and login context refresh", () => {
  test("project switch refreshes the configured project id for the selected key", async () => {
    const server = await startNetworkServer("vspec-honest-project-context-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "CTX",
        runCli
      });
      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");

      await expectOk(
        runCli(
          ["project", "create", "--name", "Alternate Project", "--key", "ALT"],
          seed.env
        )
      );

      await expectOk(runCli(["project", "switch", "CTX"], seed.env));

      const config = readConfig(configPath(seed.env));
      expect(config.current_project_key).toBe("CTX");
      expect(config.current_project_id).toBe(seed.projectId);
    } finally {
      await server.stop();
    }
  }, 30_000);

  test("returning login clears stale project context", async () => {
    const server = await startNetworkServer("vspec-honest-login-context-");
    try {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl,
        projectKey: "LOG",
        runCli
      });
      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");

      await expectOk(runCli(["login"], seed.env));

      const config = readConfig(configPath(seed.env));
      expect(config.current_workspace_id).toBeTypeOf("string");
      expect(config.current_project_id).toBeUndefined();
      expect(config.current_project_key).toBeUndefined();
    } finally {
      await server.stop();
    }
  }, 30_000);
});

function readConfig(path: string): {
  current_project_id?: string;
  current_project_key?: string;
  current_workspace_id?: string;
} {
  return JSON.parse(readFileSync(path, "utf8")) as {
    current_project_id?: string;
    current_project_key?: string;
    current_workspace_id?: string;
  };
}

function configPath(env: Record<string, string>): string {
  const path = env.VSPEC_CONFIG_PATH;
  expect(path).toBeDefined();
  return path as string;
}
