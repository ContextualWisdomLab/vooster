import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";

describe("honest CLI flow", () => {
  test("login → project create → actor create → usecase create uses persisted context", async () => {
    const server = await startNetworkServer("vspec-cli-honest-");
    const configPath = join(mkdtempSync(join(tmpdir(), "vspec-honest-")), "config.json");
    const env = {
      VSPEC_AUTH_STUB: "1",
      VSPEC_AUTH_STUB_ID: "honest-cli-user",
      VSPEC_API_URL: server.apiUrl,
      VSPEC_CONFIG_PATH: configPath
    };

    try {
      const login = await runCli([
        "login",
        "--workspace-name",
        "Honest Workspace",
        "--workspace-slug",
        "honest-workspace"
      ], env);
      expect(login.stderr).toBe("");
      expect(login.status).toBe(0);

      const project = await runCli([
        "project",
        "create",
        "--name",
        "Checkout",
        "--key",
        "HON"
      ], env);
      expect(project.stderr).toBe("");
      expect(project.status).toBe(0);

      const projectId = project.stdout.match(/Project Checkout HON ([^\s]+)/)?.[1];
      expect(projectId).toBeDefined();

      const actor = await runCli([
        "actor",
        "create",
        "--name",
        "Customer",
        "--type",
        "primary",
        "--project-id",
        projectId as string
      ], env);
      expect(actor.stderr).toBe("");
      expect(actor.status).toBe(0);

      const usecase = await runCli([
        "usecase",
        "create",
        "--title",
        "Places an order",
        "--primary-actor",
        "Customer",
        "--project-id",
        projectId as string
      ], env);
      expect(usecase.stderr).toBe("");
      expect(usecase.status).toBe(0);
      expect(usecase.stdout).toContain("HON-001");
    } finally {
      await server.stop();
    }
  });
});
