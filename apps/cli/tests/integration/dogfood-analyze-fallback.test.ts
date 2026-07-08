import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

// dogfood-analyze.sh deliberately never fabricates findings: a timed-out or
// otherwise unproductive analyzer is a HARNESS error, not a synthesized product
// finding. The old behaviour wrote a placeholder findings.json (a "false clean
// pass") — that path was purged. These tests pin the honest-failure contract:
// on timeout the script exits non-zero and writes NO findings.json, regardless
// of whether the underlying run succeeded or blew its budget.
describe("dogfood analyze honest-failure contract", () => {
  it("fails hard without writing findings when the analyzer times out", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-analyze-"));
    const bin = path.join(tmp, "bin");
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const runDir = path.join(runsDir, "cycle-analyze/DF-001");

    try {
      await mkdir(runDir, { recursive: true });
      await createSleepingClaude(bin);
      await writeFile(
        path.join(runDir, "result.json"),
        JSON.stringify({
          errors: ["Reached maximum budget ($2)"],
          is_error: true,
          session_id: "timeout-session",
          subtype: "error_max_budget_usd",
          total_cost_usd: 2.01
        })
      );
      await writeFile(path.join(runDir, "session.jsonl"), `${sessionLine()}\n`);

      await expect(
        runAnalyze("cycle-analyze", "DF-001", { bin, runsDir, stateDir })
      ).rejects.toMatchObject({ code: 1 });

      await expect(access(path.join(runDir, "findings.json"))).rejects.toThrow();
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });

  it("does not synthesize a pass when analysis times out after a successful run", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-analyze-"));
    const bin = path.join(tmp, "bin");
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const runDir = path.join(runsDir, "cycle-analyze-success/DF-006");

    try {
      await mkdir(runDir, { recursive: true });
      await createSleepingClaude(bin);
      await writeFile(
        path.join(runDir, "result.json"),
        JSON.stringify({
          errors: null,
          is_error: false,
          session_id: "success-session",
          subtype: "success",
          total_cost_usd: 1.42
        })
      );
      await writeFile(path.join(runDir, "session.jsonl"), `${sessionLine()}\n`);

      await expect(
        runAnalyze("cycle-analyze-success", "DF-006", { bin, runsDir, stateDir })
      ).rejects.toMatchObject({ code: 1 });

      await expect(access(path.join(runDir, "findings.json"))).rejects.toThrow();
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

async function runAnalyze(
  cycle: string,
  caseId: string,
  dirs: { bin: string; runsDir: string; stateDir: string }
): Promise<void> {
  await execFileAsync("bash", ["scripts/dogfood/dogfood-analyze.sh", cycle, caseId], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${dirs.bin}:${process.env.PATH ?? ""}`,
      VSPEC_DOGFOOD_ANALYZE_TIMEOUT_SECONDS: "1",
      VSPEC_DOGFOOD_RUNS_DIR: dirs.runsDir,
      VSPEC_DOGFOOD_STATE_DIR: dirs.stateDir
    },
    maxBuffer: 1024 * 1024,
    timeout: 20_000
  });
}

async function createSleepingClaude(bin: string): Promise<void> {
  await mkdir(bin, { recursive: true });
  await writeFile(path.join(bin, "claude"), "#!/usr/bin/env bash\nsleep 60\n", {
    mode: 0o755
  });
}

function sessionLine(): string {
  return JSON.stringify({
    cwd: "/tmp/dogfood",
    gitBranch: "baseline/empty",
    message: {
      content: [
        {
          text: "The dogfood run reached its automation budget before completing.",
          type: "text"
        },
        {
          input: { command: "vspec usecase create --title X" },
          name: "Bash",
          type: "tool_use"
        }
      ]
    },
    type: "assistant"
  });
}
