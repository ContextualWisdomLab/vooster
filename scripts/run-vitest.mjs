#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const wantsCoverage = rawArgs.includes("--coverage");
const hasDatabase =
  process.env.TEST_DATABASE_URL !== undefined || process.env.DATABASE_URL !== undefined;
function run(args) {
  const pnpm = pnpmCommand();
  const result = spawnSync(pnpm.command, [...pnpm.args, ...args], {
    env: process.env,
    stdio: "inherit"
  });

  if (result.error !== undefined) {
    console.error(
      `Failed to start ${pnpm.display} ${args.join(" ")}: ${result.error.message}`
    );
    process.exit(1);
  }

  process.exitCode = result.status ?? 1;
  if (process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

function pnpmCommand() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath !== undefined && path.basename(npmExecPath).includes("pnpm")) {
    return {
      args: [npmExecPath],
      command: process.execPath,
      display: "pnpm"
    };
  }
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", "pnpm"],
      command: "cmd.exe",
      display: "pnpm"
    };
  }
  return {
    args: [],
    command: "pnpm",
    display: "pnpm"
  };
}

if (wantsCoverage) {
  run(["--filter", "@vooster/contracts", "build"]);
}

if (wantsCoverage && !hasDatabase) {
  console.log(
    "No TEST_DATABASE_URL or DATABASE_URL detected; running the DB-free unit coverage subset for central evidence. CI and Verify run the full DB-backed suites separately."
  );
  run([
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.opencode-coverage.config.ts",
    "--coverage"
  ]);
} else {
  run(["exec", "vitest", "run", ...rawArgs]);
}
