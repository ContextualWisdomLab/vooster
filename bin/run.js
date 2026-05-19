#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { error as logError } from "node:console";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

try {
  if (process.env.VSPEC_CLI_SOURCE === "1") {
    throw Object.assign(new Error("Use source CLI"), { code: "ERR_MODULE_NOT_FOUND" });
  }

  const cli = await import("../dist/src/cli/index.js");
  await cli.runCli(argv);
} catch (error) {
  if (!isMissingBuiltCli(error)) {
    throw error;
  }

  const sourceCli = resolve(binDir, "../src/cli/index.ts");
  const result = spawnSync(process.execPath, ["--import", "tsx", sourceCli, ...argv], {
    stdio: "inherit"
  });

  if (result.error !== undefined) {
    logError(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function isMissingBuiltCli(error) {
  return error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
}
