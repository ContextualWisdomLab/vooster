import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood provision pack install", () => {
  it("installs a packed vspec CLI that runs from a temporary global prefix", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-pack-"));
    const repo = path.join(tmp, "repo");
    const prefix = path.join(tmp, "prefix");

    try {
      await createDogfoodRepo(repo);
      await mkdir(prefix, { recursive: true });

      const env = {
        ...process.env,
        NPM_CONFIG_PREFIX: prefix,
        PATH: `${path.join(prefix, "bin")}:${process.env.PATH ?? ""}`,
        VSPEC_DOGFOOD_API_URL: "http://127.0.0.1:8799",
        VSPEC_DOGFOOD_CASES: "DF-001",
        VSPEC_DOGFOOD_LINK: "pack",
        VSPEC_DOGFOOD_REPO: repo,
        VSPEC_DOGFOOD_SESSION_COOKIE: "vspec_session=test-session"
      };

      await execFileAsync("bash", ["scripts/dogfood/dogfood-provision.sh"], {
        cwd: root,
        env,
        maxBuffer: 1024 * 1024 * 8,
        timeout: 120_000
      });

      const vspec = path.join(prefix, "bin", "vspec");
      expect(existsSync(vspec)).toBe(true);

      const result = await execFileAsync(vspec, ["--version"], {
        cwd: repo,
        env,
        maxBuffer: 1024 * 1024
      });
      expect(result.stdout).toMatch(/^vspec\//);
      expect(result.stderr).not.toMatch(
        /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Use source CLI/
      );
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  }, 120_000);
});

async function createDogfoodRepo(repo: string): Promise<void> {
  await mkdir(repo, { recursive: true });
  await execFileAsync("git", ["init", "-q"], { cwd: repo });
  await writeFile(
    path.join(repo, "CLAUDE.md"),
    "This repo uses vspec for use case specifications.\n"
  );
  await execFileAsync("git", ["add", "CLAUDE.md"], { cwd: repo });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.email=dogfood@vspec.local",
      "-c",
      "user.name=dogfood",
      "commit",
      "-qm",
      "baseline/empty"
    ],
    { cwd: repo }
  );
  await execFileAsync("git", ["branch", "baseline/empty"], { cwd: repo });
}
