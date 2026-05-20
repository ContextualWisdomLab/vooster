import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Goal 2 boundary config", () => {
  test("forbids http to domain and cli to infrastructure imports", () => {
    const config = readFileSync("eslint.config.js", "utf8");

    expect(config).toMatch(/from:\s*"http"[^}]*disallow[^}]*"domain"/);
    expect(config).toMatch(/from:\s*"cli"[^}]*disallow[^}]*"infrastructure"/);
  });
});
