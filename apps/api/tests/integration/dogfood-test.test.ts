import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const bashBin =
  process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";

describe("dogfood-test", () => {
  it("consumes the existing build without invoking pnpm", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-"));
    const bin = path.join(tmp, "bin");
    const marker = path.join(tmp, "pnpm-called");
    await mkdir(bin);
    await writeFile(
      path.join(bin, "pnpm"),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > ${shellQuote(marker)}\nexit 42\n`,
      { mode: 0o755 }
    );

    try {
      await execFileAsync(bashBin, ["scripts/dogfood-test.sh"], {
        cwd: root,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
        maxBuffer: 1024 * 1024
      });
      await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } catch (error: unknown) {
      await expectNoPnpmInvocation(marker);
      throw error;
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  }, 30_000);
});

async function expectNoPnpmInvocation(marker: string): Promise<void> {
  try {
    const invocation = await readFile(marker, "utf8");
    throw new Error(`dogfood-test invoked pnpm with: ${invocation.trim()}`);
  } catch (error: unknown) {
    if (isNotFound(error)) {
      return;
    }
    throw error;
  }
}

function isNotFound(error: unknown): error is { code: "ENOENT" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
