import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InitCommand, runInit } from "../../src/commands/init.js";
import { localConfigPath } from "../../src/config-store.js";

describe("init command", () => {
  const tmpDirs: string[] = [];
  const previousConfigPath = process.env.VSPEC_CONFIG_PATH;

  beforeEach(() => {
    process.env.VSPEC_CONFIG_PATH = join(tempDir(), "login-config.json");
    writeFileSync(
      process.env.VSPEC_CONFIG_PATH,
      `${JSON.stringify({ api_url: "https://api.example.test", session_token: "session-token" })}\n`
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousConfigPath === undefined) {
      delete process.env.VSPEC_CONFIG_PATH;
    } else {
      process.env.VSPEC_CONFIG_PATH = previousConfigPath;
    }
    for (const dir of tmpDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("lives in a real oclif command module", () => {
    expect(InitCommand.prototype).toBeInstanceOf(Command);
  });

  it("writes per-repo project context resolved from the API", async () => {
    stubProjects([
      { id: "project-1", key: "ACME", name: "Acme", workspace_id: "workspace-1" }
    ]);
    const cwd = tempDir();

    await runInit({ project: "ACME" }, cwd, () => {
      return undefined;
    });

    expect(JSON.parse(readFileSync(localConfigPath(cwd), "utf8"))).toEqual({
      api_url: "https://api.example.test",
      current_project_id: "project-1",
      current_project_key: "ACME",
      current_workspace_id: "workspace-1"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/projects",
      expect.anything()
    );
  });

  it("fails validation when --project is missing", async () => {
    await expect(
      runInit({}, tempDir(), () => {
        return undefined;
      })
    ).rejects.toThrow(/--project/);
  });

  it("refuses existing config unless --force is set", async () => {
    stubProjects([
      { id: "project-2", key: "NEW", name: "New", workspace_id: "workspace-2" }
    ]);
    const cwd = tempDir();
    mkdirSync(join(cwd, ".vspec"), { recursive: true });
    writeFileSync(
      localConfigPath(cwd),
      `${JSON.stringify({ current_project_key: "OLD" })}\n`
    );

    await expect(
      runInit({ project: "NEW" }, cwd, () => {
        return undefined;
      })
    ).rejects.toThrow(/already exists/);

    await runInit({ force: true, project: "NEW" }, cwd, () => {
      return undefined;
    });

    expect(JSON.parse(readFileSync(localConfigPath(cwd), "utf8"))).toEqual({
      api_url: "https://api.example.test",
      current_project_id: "project-2",
      current_project_key: "NEW",
      current_workspace_id: "workspace-2"
    });
  });

  it("writes an optional vspec verify workflow", async () => {
    stubProjects([
      { id: "project-1", key: "ACME", name: "Acme", workspace_id: "workspace-1" }
    ]);
    const cwd = tempDir();
    const lines: string[] = [];

    await runInit({ project: "ACME", "verify-workflow": true }, cwd, (line) =>
      lines.push(line)
    );

    const workflowPath = join(cwd, ".github/workflows/vspec-verify.yml");
    const workflow = readFileSync(workflowPath, "utf8");
    expect(workflow).toContain("name: Vspec Verify");
    expect(workflow).toContain("uses: vibemafiaclub/vooster@main");
    expect(workflow).toContain(
      "usecase-key: \"${{ vars.VSPEC_VERIFY_USECASE || 'ACME-001' }}\""
    );
    expect(workflow).toContain(
      "test-command: \"${{ vars.VSPEC_VERIFY_TEST_COMMAND || 'pnpm test' }}\""
    );
    expect(lines).toContain(`Verify workflow ${workflowPath}`);
  });

  it("refuses to overwrite an existing verify workflow unless --force is set", async () => {
    stubProjects([
      { id: "project-1", key: "ACME", name: "Acme", workspace_id: "workspace-1" }
    ]);
    const cwd = tempDir();
    const workflowPath = join(cwd, ".github/workflows/vspec-verify.yml");
    mkdirSync(join(cwd, ".github/workflows"), { recursive: true });
    writeFileSync(workflowPath, "name: Existing\n");

    await expect(
      runInit({ project: "ACME", "verify-workflow": true }, cwd, () => undefined)
    ).rejects.toThrow(/vspec-verify.yml already exists/);

    await runInit(
      { force: true, project: "ACME", "verify-workflow": true },
      cwd,
      () => undefined
    );

    expect(readFileSync(workflowPath, "utf8")).toContain("name: Vspec Verify");
  });

  it("names the missing project key when the API does not list it", async () => {
    stubProjects([
      { id: "project-1", key: "ACME", name: "Acme", workspace_id: "workspace-1" }
    ]);

    await expect(
      runInit({ project: "NOPE" }, tempDir(), () => undefined)
    ).rejects.toThrow(/NOPE/);
  });

  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "vspec-init-"));
    tmpDirs.push(dir);
    return dir;
  }

  function stubProjects(
    items: Array<{ id: string; key: string; name: string; workspace_id: string }>
  ): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          headers: new Headers(),
          json: () => Promise.resolve({ items }),
          ok: true
        } as Response)
      )
    );
  }
});
