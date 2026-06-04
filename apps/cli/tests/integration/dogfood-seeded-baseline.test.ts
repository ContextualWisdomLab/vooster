import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood seeded baselines", () => {
  it("hydrates seeded-small before running the agent case", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-seeded-"));
    const repo = path.join(tmp, "repo");
    const home = path.join(tmp, "home");
    const bin = path.join(tmp, "bin");
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const calls = path.join(tmp, "calls.log");
    const sessionId = "stub-seeded-session";

    try {
      await createSeededSmallRepo(repo);
      await mkdir(path.join(repo, ".vspec"), { recursive: true });
      await writeFile(path.join(repo, ".vspec", "global-config.json"), "{}\n");
      await createVspecStub(bin, calls);
      await createClaudeStub(bin, sessionId, calls);
      await createTranscript(home, sessionId);

      await execFileAsync(
        "bash",
        ["scripts/dogfood/dogfood-run.sh", "cycle-test", "DF-003"],
        {
          cwd: root,
          env: {
            ...process.env,
            HOME: home,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            VSPEC_DOGFOOD_AUTH_STUB_ID: "dogfood-test",
            VSPEC_DOGFOOD_GLOBAL_CONFIG: path.join(
              repo,
              ".vspec",
              "global-config.json"
            ),
            VSPEC_DOGFOOD_RUNS_DIR: runsDir,
            VSPEC_DOGFOOD_REPO: repo,
            VSPEC_DOGFOOD_STATE_DIR: stateDir
          },
          maxBuffer: 1024 * 1024
        }
      );

      const logged = await readFile(calls, "utf8");
      expect(logged).toContain(
        "vspec project create --key POCKET --name Pocket --format=agent"
      );
      expect(logged).toContain("vspec init --project POCKET --force --format=agent");
      expect(logged).toContain(
        "vspec usecase create --title User logs a new expense --primary-actor Account Holder --force --format=agent"
      );
      expect(logged).toContain(
        "vspec scenario add POCKET-001 --type EXTENSION --at 2a"
      );
      expect(logged.indexOf("vspec project create")).toBeLessThan(
        logged.indexOf("claude ")
      );
      await expect(
        readFile(path.join(runsDir, "cycle-test", "DF-003", "session.jsonl"), "utf8")
      ).resolves.toContain("seeded transcript");
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

async function createSeededSmallRepo(repo: string): Promise<void> {
  await mkdir(path.join(repo, "specs"), { recursive: true });
  await execFileAsync("git", ["init", "-q"], { cwd: repo });
  await writeFile(path.join(repo, "CLAUDE.md"), "Use vspec.\n");
  await writeFile(
    path.join(repo, "specs", "SEED_NOTES.md"),
    "# seeded-small baseline (placeholder)\n"
  );
  await execFileAsync("git", ["add", "CLAUDE.md", "specs/SEED_NOTES.md"], {
    cwd: repo
  });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.email=dogfood@vspec.local",
      "-c",
      "user.name=dogfood",
      "commit",
      "-qm",
      "baseline/seeded-small"
    ],
    { cwd: repo }
  );
  await execFileAsync("git", ["branch", "baseline/seeded-small"], { cwd: repo });
}

async function createVspecStub(bin: string, calls: string): Promise<void> {
  await mkdir(bin, { recursive: true });
  await writeFile(
    path.join(bin, "vspec"),
    `#!/usr/bin/env bash
printf 'vspec %s\\n' "$*" >> '${calls.replaceAll("'", "'\\''")}'
case "$*" in
  "project list --format=agent")
    printf '{"data":{"items":[]},"format_version":1}\\n'
    ;;
  "init --project POCKET --force --format=agent")
    mkdir -p .vspec
    printf '{}\\n' > .vspec/config.json
    printf '{"data":{"current_project_key":"POCKET"},"format_version":1}\\n'
    ;;
  "usecase show POCKET-001 --format=agent")
    exit 1
    ;;
  "scenario add POCKET-001 --type MAIN_SUCCESS --outcome SUCCESS --format=agent")
    printf '{"data":{"scenario":{"id":"scenario-main"}},"format_version":1}\\n'
    ;;
  "scenario add POCKET-001 --type EXTENSION --at 2a --condition Amount is missing or invalid --outcome FAILURE --format=agent")
    printf '{"data":{"scenario":{"id":"scenario-extension"}},"format_version":1}\\n'
    ;;
  "pull --format=agent")
    mkdir -p specs
    printf '%s\\n' '---' 'key: POCKET-001' 'revision: revision-1' '---' '# User logs a new expense' > specs/POCKET-001.md
    printf '{"data":{"files":[{"path":"specs/POCKET-001.md"}]},"format_version":1}\\n'
    ;;
  *)
    printf '{"data":{},"format_version":1}\\n'
    ;;
esac
`,
    { mode: 0o755 }
  );
}

async function createClaudeStub(
  bin: string,
  sessionId: string,
  calls: string
): Promise<void> {
  await writeFile(
    path.join(bin, "claude"),
    `#!/usr/bin/env bash
printf 'claude %s\\n' "$*" >> '${calls.replaceAll("'", "'\\''")}'
cat <<'JSON'
{"type":"result","subtype":"success","duration_ms":1,"is_error":false,"num_turns":1,"session_id":"${sessionId}","total_cost_usd":0.01}
JSON
`,
    { mode: 0o755 }
  );
}

async function createTranscript(home: string, sessionId: string): Promise<void> {
  const dir = path.join(home, ".claude", "projects", "stub");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${sessionId}.jsonl`), "seeded transcript\n");
}
