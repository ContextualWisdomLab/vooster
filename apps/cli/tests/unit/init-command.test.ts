import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "@oclif/core";
import { afterEach, describe, expect, it } from "vitest";

import { InitCommand, runInit } from "../../src/commands/init.js";
import { localConfigPath } from "../../src/config-store.js";

describe("init command", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("lives in a real oclif command module", () => {
    expect(InitCommand.prototype).toBeInstanceOf(Command);
  });

  it("writes a per-repo current project key", () => {
    const cwd = tempDir();

    runInit({ project: "ACME" }, cwd, () => {
      return undefined;
    });

    expect(JSON.parse(readFileSync(localConfigPath(cwd), "utf8"))).toEqual({
      current_project_key: "ACME"
    });
  });

  it("fails validation when --project is missing", () => {
    expect(() => {
      runInit({}, tempDir(), () => {
        return undefined;
      });
    }).toThrow(/--project/);
  });

  it("refuses existing config unless --force is set", () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".vspec"), { recursive: true });
    writeFileSync(localConfigPath(cwd), `${JSON.stringify({ current_project_key: "OLD" })}\n`);

    expect(() => {
      runInit({ project: "NEW" }, cwd, () => {
        return undefined;
      });
    }).toThrow(/already exists/);

    runInit({ force: true, project: "NEW" }, cwd, () => {
      return undefined;
    });

    expect(JSON.parse(readFileSync(localConfigPath(cwd), "utf8"))).toEqual({
      current_project_key: "NEW"
    });
  });

  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "vspec-init-"));
    tmpDirs.push(dir);
    return dir;
  }
});
