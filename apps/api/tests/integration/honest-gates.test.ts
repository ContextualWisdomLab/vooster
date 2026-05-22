import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../../../..");
const fixtureRoot = path.join(tmpdir(), "vooster-honest-gates-test");

type ExecResult = {
  stdout: string;
  stderr: string;
};

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
        '  expect(body).toContain("boundaries/dependencies");',
        "});"
      ].join("\n")
    );

    await expect(runHonestGates(testsDir)).rejects.toSatisfy((error: unknown) =>
      outputFrom(error).stdout.includes("dishonest.test.ts")
    );
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

    const result = await runHonestGates(testsDir);
    expect(result.stdout).toContain("check-honest-gates");
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
  }) as Promise<ExecResult>;
}

function outputFrom(error: unknown): ExecResult {
  if (
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    "stderr" in error
  ) {
    const output = error as Partial<ExecResult>;
    return {
      stderr: output.stderr ?? "",
      stdout: output.stdout ?? ""
    };
  }

  return { stderr: "", stdout: "" };
}
