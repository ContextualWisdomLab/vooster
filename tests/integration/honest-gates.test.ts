import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const fixtureRoot = path.join(root, ".state/honest-gates-test");

describe("honest gates script", () => {
  test("rejects tests that assert on raw config file text", async () => {
    const testsDir = await fixtureDir("dishonest");
    const offender = path.join(testsDir, "dishonest.test.ts");
    await writeFile(
      offender,
      [
        'import { readFileSync } from "node:fs";',
        'import { expect, test } from "vitest";',
        'test("dishonest", () => {',
        '  const body = readFileSync("eslint.config.js", "utf8");',
        '  expect(body).toContain("boundaries/element-types");',
        "});"
      ].join("\n")
    );

    await expect(runHonestGates(testsDir)).rejects.toMatchObject({
      stdout: expect.stringContaining("dishonest.test.ts")
    });
  });

  test("allows tests that parse config structurally", async () => {
    const testsDir = await fixtureDir("honest");
    await writeFile(
      path.join(testsDir, "honest.test.ts"),
      [
        'import { readFileSync } from "node:fs";',
        'import { expect, test } from "vitest";',
        'test("honest", () => {',
        '  const parsed = JSON.parse(readFileSync("package.json", "utf8"));',
        '  expect(Object.keys(parsed.scripts)).toContain("test");',
        "});"
      ].join("\n")
    );

    await expect(runHonestGates(testsDir)).resolves.toMatchObject({
      stdout: expect.stringContaining("check-honest-gates")
    });
  });
});

async function fixtureDir(name: string): Promise<string> {
  const dir = path.join(fixtureRoot, name);
  await rm(dir, { force: true, recursive: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

async function runHonestGates(testsDir: string) {
  return execFileAsync("bash", ["scripts/check-honest-gates.sh"], {
    cwd: root,
    env: {
      ...process.env,
      HONEST_GATES_TESTS_DIR: testsDir
    }
  });
}
