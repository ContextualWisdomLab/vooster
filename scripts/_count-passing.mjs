#!/usr/bin/env node
// _count-passing.mjs — Run vitest and emit the number of passing tests.
// Used by verify-tdd.sh and verify-no-regression.sh so they do not have to
// parse stdout/stderr interleaving in shell.

import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const dir = mkdtempSync(join(tmpdir(), "vspec-vitest-"));
const out = join(dir, "results.json");

const result = spawnSync(
  "npx",
  ["--no-install", "vitest", "run", "--reporter=json", `--outputFile=${out}`],
  { stdio: ["ignore", "ignore", "ignore"] }
);

let passed = 0;
let exit = result.status ?? 1;
try {
  const json = JSON.parse(readFileSync(out, "utf8"));
  passed = Number(json.numPassedTests ?? 0);
} catch {
  // Treat parse failure as zero passing — caller must decide.
  passed = 0;
  exit = exit || 2;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(String(passed) + "\n");
process.exit(exit);
