import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  discoverLocalConfigPath,
  localConfigPath,
  readConfig,
  writeConfig
} from "../../src/config-store.js";

describe("config-store", () => {
  const tmpDirs: string[] = [];
  const previousEnv: {
    HOME?: string;
    NODE_ENV?: string;
    VSPEC_CONFIG_PATH?: string;
    VSPEC_GLOBAL_CONFIG_PATH?: string;
  } = {};

  beforeEach(() => {
    previousEnv.HOME = process.env.HOME;
    previousEnv.NODE_ENV = process.env.NODE_ENV;
    previousEnv.VSPEC_CONFIG_PATH = process.env.VSPEC_CONFIG_PATH;
    previousEnv.VSPEC_GLOBAL_CONFIG_PATH = process.env.VSPEC_GLOBAL_CONFIG_PATH;
    delete process.env.VSPEC_CONFIG_PATH;
    process.env.VSPEC_GLOBAL_CONFIG_PATH = join(tempDir(), "global-config.json");
  });

  afterEach(() => {
    restoreEnv("HOME", previousEnv.HOME);
    restoreEnv("NODE_ENV", previousEnv.NODE_ENV);
    if (previousEnv.VSPEC_CONFIG_PATH === undefined) {
      delete process.env.VSPEC_CONFIG_PATH;
    } else {
      process.env.VSPEC_CONFIG_PATH = previousEnv.VSPEC_CONFIG_PATH;
    }
    if (previousEnv.VSPEC_GLOBAL_CONFIG_PATH === undefined) {
      delete process.env.VSPEC_GLOBAL_CONFIG_PATH;
    } else {
      process.env.VSPEC_GLOBAL_CONFIG_PATH = previousEnv.VSPEC_GLOBAL_CONFIG_PATH;
    }
    for (const dir of tmpDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  describe("discoverLocalConfigPath", () => {
    it("returns null when no .vspec/config.json exists above cwd", () => {
      expect(discoverLocalConfigPath(tempDir())).toBeNull();
    });

    it("returns the local config path when cwd contains .vspec/config.json", () => {
      const cwd = tempDir();
      seedLocal(cwd, { current_project_key: "ACME" });
      expect(discoverLocalConfigPath(cwd)).toBe(localConfigPath(cwd));
    });

    it("walks up parent directories until it finds .vspec/config.json", () => {
      const repo = tempDir();
      seedLocal(repo, { current_project_key: "ACME" });
      const nested = join(repo, "apps", "cli");
      mkdirSync(nested, { recursive: true });
      expect(discoverLocalConfigPath(nested)).toBe(localConfigPath(repo));
    });

    it("stops at a git repo root instead of treating home config as local", () => {
      seedGlobal({ api_url: "https://example.com", session_token: "global-token" });
      const home = tempDir();
      process.env.HOME = home;
      seedLocal(home, { session_token: "stale-home-token" });
      const repo = join(home, "work", "pocket");
      mkdirSync(join(repo, ".git"), { recursive: true });

      expect(discoverLocalConfigPath(repo)).toBeNull();
      expect(readConfig({ cwd: repo })).toEqual({
        api_url: "https://example.com",
        session_token: "global-token"
      });
    });
  });

  describe("readConfig with cwd overlay", () => {
    it("layers per-repo current_project_key over the global config", () => {
      seedGlobal({ api_url: "https://example.com", session_token: "global-token" });
      const repo = tempDir();
      seedLocal(repo, { current_project_key: "ACME" });

      const config = readConfig({ cwd: repo });

      expect(config.api_url).toBe("https://example.com");
      expect(config.session_token).toBe("global-token");
      expect(config.current_project_key).toBe("ACME");
    });

    it("ignores cwd overlay when VSPEC_CONFIG_PATH is set", () => {
      const isolated = join(tempDir(), "config.json");
      writeFileSync(isolated, JSON.stringify({ api_url: "https://isolated" }));
      process.env.VSPEC_CONFIG_PATH = isolated;

      const repo = tempDir();
      seedLocal(repo, { current_project_key: "ACME" });

      const config = readConfig({ cwd: repo });

      expect(config.api_url).toBe("https://isolated");
      expect(config.current_project_key).toBeUndefined();
    });
  });

  describe("writeConfig isolation", () => {
    it("refuses implicit global writes from test contexts", () => {
      const home = tempDir();
      delete process.env.VSPEC_CONFIG_PATH;
      delete process.env.VSPEC_GLOBAL_CONFIG_PATH;
      process.env.HOME = home;
      setEnv("NODE_ENV", "test");

      expect(() => {
        writeConfig({ session_token: "token" });
      }).toThrow(/VSPEC_CONFIG_PATH/);
      expect(existsSync(join(home, ".vspec", "config.json"))).toBe(false);
    });

    it("does not bleed the per-repo overlay into the global config when writing the global config", () => {
      seedGlobal({ api_url: "https://example.com" });
      const repo = tempDir();
      seedLocal(repo, { current_project_key: "ACME" });

      const originalCwd = process.cwd();
      process.chdir(repo);
      try {
        writeConfig({ session_token: "token" });
      } finally {
        process.chdir(originalCwd);
      }

      const globalAfter = readGlobal();
      expect(globalAfter.session_token).toBe("token");
      expect(globalAfter.current_project_key).toBeUndefined();
    });
  });

  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "vspec-config-store-"));
    tmpDirs.push(dir);
    return dir;
  }

  function seedGlobal(values: Record<string, string>): void {
    const globalPath = process.env.VSPEC_GLOBAL_CONFIG_PATH;
    if (globalPath === undefined) {
      throw new Error("VSPEC_GLOBAL_CONFIG_PATH not set in test");
    }
    mkdirSync(dirname(globalPath), { recursive: true });
    writeFileSync(globalPath, JSON.stringify(values));
  }

  function readGlobal(): Record<string, unknown> {
    const globalPath = process.env.VSPEC_GLOBAL_CONFIG_PATH;
    if (globalPath === undefined) {
      throw new Error("VSPEC_GLOBAL_CONFIG_PATH not set in test");
    }
    return JSON.parse(readFileSync(globalPath, "utf8")) as Record<string, unknown>;
  }

  function seedLocal(cwd: string, values: Record<string, string>): void {
    mkdirSync(join(cwd, ".vspec"), { recursive: true });
    writeFileSync(join(cwd, ".vspec", "config.json"), JSON.stringify(values));
  }

  function restoreEnv(name: "HOME" | "NODE_ENV", value: string | undefined): void {
    if (value === undefined) {
      if (name === "HOME") {
        Reflect.deleteProperty(process.env, "HOME");
      } else {
        Reflect.deleteProperty(process.env, "NODE_ENV");
      }
      return;
    }
    setEnv(name, value);
  }

  function setEnv(name: "HOME" | "NODE_ENV", value: string): void {
    (process.env as Record<string, string | undefined>)[name] = value;
  }
});
