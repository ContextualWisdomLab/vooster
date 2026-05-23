import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveContextFlag } from "../../src/flag-values.js";

describe("resolveContextFlag", () => {
  const tmpDirs: string[] = [];
  const originalCwd = process.cwd();
  const previousEnv: {
    VSPEC_CONFIG_PATH?: string;
    VSPEC_GLOBAL_CONFIG_PATH?: string;
  } = {};

  beforeEach(() => {
    previousEnv.VSPEC_CONFIG_PATH = process.env.VSPEC_CONFIG_PATH;
    previousEnv.VSPEC_GLOBAL_CONFIG_PATH = process.env.VSPEC_GLOBAL_CONFIG_PATH;
    process.env.VSPEC_CONFIG_PATH = join(tempDir(), "config.json");
    process.env.VSPEC_GLOBAL_CONFIG_PATH = join(tempDir(), "global-config.json");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    restoreEnv("VSPEC_CONFIG_PATH", previousEnv.VSPEC_CONFIG_PATH);
    restoreEnv("VSPEC_GLOBAL_CONFIG_PATH", previousEnv.VSPEC_GLOBAL_CONFIG_PATH);
    for (const dir of tmpDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("prefers --project-id over configured current_project_id", () => {
    writeIsolatedConfig({ current_project_id: "config-project" });

    expect(resolveContextFlag({ "project-id": "flag-project" }, "project-id")).toBe(
      "flag-project"
    );
  });

  it("resolves project-id from isolated config", () => {
    writeIsolatedConfig({ current_project_id: "config-project" });

    expect(resolveContextFlag({}, "project-id")).toBe("config-project");
  });

  it("resolves project-id from local .vspec config", () => {
    delete process.env.VSPEC_CONFIG_PATH;
    const repo = tempDir();
    mkdirSync(join(repo, ".vspec"), { recursive: true });
    writeFileSync(
      join(repo, ".vspec", "config.json"),
      `${JSON.stringify({ current_project_id: "local-project" })}\n`
    );
    process.chdir(repo);

    expect(resolveContextFlag({}, "project-id")).toBe("local-project");
  });

  it("throws an actionable error when project-id is missing", () => {
    expect(() => resolveContextFlag({}, "project-id")).toThrow(
      "Missing project-id. Run 'vspec login' or pass --project-id."
    );
  });

  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "vspec-flag-values-"));
    tmpDirs.push(dir);
    return dir;
  }

  function writeIsolatedConfig(values: Record<string, string>): void {
    const configPath = process.env.VSPEC_CONFIG_PATH;
    if (configPath === undefined) {
      throw new Error("VSPEC_CONFIG_PATH not set");
    }
    writeFileSync(configPath, `${JSON.stringify(values)}\n`);
  }
});

function restoreEnv(
  name: "VSPEC_CONFIG_PATH" | "VSPEC_GLOBAL_CONFIG_PATH",
  value: string | undefined
): void {
  if (value === undefined) {
    if (name === "VSPEC_CONFIG_PATH") {
      delete process.env.VSPEC_CONFIG_PATH;
    } else {
      delete process.env.VSPEC_GLOBAL_CONFIG_PATH;
    }
    return;
  }

  process.env[name] = value;
}
