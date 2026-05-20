#!/usr/bin/env node
// _uc-status.mjs — Run vitest once across the given dirs/files, emit one
// `<relative-test-file>\t<PASS|FAIL>` line per test file. Replaces the
// per-UC vitest cold-starts in diagnose.sh and update-state.sh.
//
// Usage:
//   node scripts/_uc-status.mjs tests/e2e
//   node scripts/_uc-status.mjs tests/e2e tests/e2e-cli
//
// Exit code is 0 if vitest produced parsable json (regardless of pass/fail).
// Non-zero only if the run could not be invoked or the json was unreadable —
// in that case callers should treat every file as not-run.

import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import process from "node:process";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "vspec-uc-status-"));
const out = join(dir, "results.json");

spawnSync(
  "npx",
  [
    "--no-install",
    "vitest",
    "run",
    ...targets,
    "--reporter=json",
    `--outputFile=${out}`
  ],
  { stdio: ["ignore", "ignore", "ignore"] }
);

let exitCode = 0;
try {
  const json = JSON.parse(readFileSync(out, "utf8"));
  for (const tr of json.testResults ?? []) {
    const status = tr.status === "passed" ? "PASS" : "FAIL";
    const rel = relative(process.cwd(), tr.name ?? "");
    process.stdout.write(`${rel}\t${status}\n`);
  }
} catch {
  exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.exit(exitCode);
