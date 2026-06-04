import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood run budget evidence", () => {
  it("captures a structured claude budget error as analyzable evidence", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-run-"));
    const repo = path.join(tmp, "repo");
    const home = path.join(tmp, "home");
    const bin = path.join(tmp, "bin");
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const marker = path.join(tmp, "global-config-path.txt");
    const sessionId = "stub-budget-session";
    const realLedger = path.join(root, ".state", "dogfood", "ledger.tsv");
    const realLedgerBefore = await readOptional(realLedger);

    try {
      await createDogfoodRepo(repo);
      await mkdir(path.join(repo, ".vspec"), { recursive: true });
      await writeFile(path.join(repo, ".vspec", "config.json"), '{"stale":true}\n');
      await writeFile(path.join(repo, ".vspec", "global-config.json"), "{}\n");
      await createClaudeStub(bin, sessionId, marker);
      await createVspecStub(bin);
      await createTranscript(home, sessionId);

      await execFileAsync(
        "bash",
        ["scripts/dogfood/dogfood-run.sh", "cycle-test", "DF-001"],
        {
          cwd: root,
          env: {
            ...process.env,
            HOME: home,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            VSPEC_DOGFOOD_AUTH_STUB_ID: "dogfood-test",
            VSPEC_DOGFOOD_RUNS_DIR: runsDir,
            VSPEC_DOGFOOD_REPO: repo,
            VSPEC_DOGFOOD_STATE_DIR: stateDir
          },
          maxBuffer: 1024 * 1024
        }
      );

      const runDir = path.join(runsDir, "cycle-test/DF-001");
      const result: unknown = JSON.parse(
        await readFile(path.join(runDir, "result.json"), "utf8")
      );
      expect(result).toMatchObject({ is_error: true, session_id: sessionId });
      const markerLines = (await readFile(marker, "utf8")).trimEnd().split("\n");
      expect(markerLines[0]).toBe(path.join(repo, ".vspec", "global-config.json"));
      expect(markerLines[1]).toBe(path.join(stateDir, "bin", "vspec"));
      expect(markerLines[2]).toBe("dogfood-test");
      await expect(readOptional(realLedger)).resolves.toBe(realLedgerBefore);
      await expectFileMissing(path.join(repo, ".vspec", "config.json"));
      await expect(
        readFile(path.join(runDir, "session.jsonl"), "utf8")
      ).resolves.toContain("budget transcript");
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

async function createDogfoodRepo(repo: string): Promise<void> {
  await mkdir(repo, { recursive: true });
  await execFileAsync("git", ["init", "-q"], { cwd: repo });
  await writeFile(path.join(repo, "CLAUDE.md"), "Use vspec.\n");
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

async function createClaudeStub(
  bin: string,
  sessionId: string,
  marker: string
): Promise<void> {
  await mkdir(bin, { recursive: true });
  await writeFile(
    path.join(bin, "claude"),
    `#!/usr/bin/env bash
{
  printf '%s\\n' "$VSPEC_GLOBAL_CONFIG_PATH"
  command -v vspec
  printf '%s\\n' "$VSPEC_AUTH_STUB_ID"
} > '${marker.replaceAll("'", "'\\''")}'
cat <<'JSON'
{"type":"result","subtype":"error_max_budget_usd","duration_ms":1,"is_error":true,"num_turns":3,"session_id":"${sessionId}","total_cost_usd":2.01,"errors":["Reached maximum budget ($2)"]}
JSON
exit 1
`,
    { mode: 0o755 }
  );
}

async function createVspecStub(bin: string): Promise<void> {
  await writeFile(
    path.join(bin, "vspec"),
    "#!/usr/bin/env bash\nprintf 'stub-vspec\\n'\n",
    { mode: 0o755 }
  );
}

async function createTranscript(home: string, sessionId: string): Promise<void> {
  const dir = path.join(home, ".claude", "projects", "stub");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${sessionId}.jsonl`), "budget transcript\n");
}

async function expectFileMissing(file: string): Promise<void> {
  try {
    await access(file);
    throw new Error(`${file} should not exist`);
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

async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error: unknown) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}
