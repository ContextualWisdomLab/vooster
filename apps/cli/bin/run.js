#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { error as logError } from "node:console";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const require = createRequire(import.meta.url);

try {
  if (process.env.VSPEC_CLI_SOURCE === "1") {
    throw Object.assign(new Error("Use source CLI"), { code: "ERR_MODULE_NOT_FOUND" });
  }

  const cli = await import("../../dist/apps/cli/src/index.js");
  await cli.runCli(argv);
} catch (error) {
  if (!isMissingBuiltCli(error)) {
    throw error;
  }

  const sourceCli = resolve(binDir, "../src/index.ts");
  const result = spawnSync(
    process.execPath,
    ["--import", require.resolve("tsx"), sourceCli, ...argv],
    {
      stdio: "inherit"
    }
  );

  if (result.error !== undefined) {
    logError(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function isMissingBuiltCli(error) {
  return (
    error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND"
  );
}
