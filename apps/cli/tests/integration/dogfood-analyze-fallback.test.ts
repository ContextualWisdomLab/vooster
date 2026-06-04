import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood analyze fallback", () => {
  it("writes fallback findings when the analyzer times out", async () => {
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

      await execFileAsync(
        "bash",
        ["scripts/dogfood/dogfood-analyze.sh", "cycle-analyze", "DF-001"],
        {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            VSPEC_DOGFOOD_ANALYZE_TIMEOUT_SECONDS: "1",
            VSPEC_DOGFOOD_RUNS_DIR: runsDir,
            VSPEC_DOGFOOD_STATE_DIR: stateDir
          },
          maxBuffer: 1024 * 1024,
          timeout: 20_000
        }
      );

      const findings: unknown = JSON.parse(
        await readFile(path.join(runDir, "findings.json"), "utf8")
      );
      expect(findings).toMatchObject({
        case_id: "DF-001",
        task_succeeded: false
      });
      expect(JSON.stringify(findings)).toContain('"severity":"P1"');
      expect(JSON.stringify(findings)).toMatch(/budget/i);
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });

  it("does not create a P1 when analysis times out after a successful run", async () => {
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

      await execFileAsync(
        "bash",
        ["scripts/dogfood/dogfood-analyze.sh", "cycle-analyze-success", "DF-006"],
        {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            VSPEC_DOGFOOD_ANALYZE_TIMEOUT_SECONDS: "1",
            VSPEC_DOGFOOD_RUNS_DIR: runsDir,
            VSPEC_DOGFOOD_STATE_DIR: stateDir
          },
          maxBuffer: 1024 * 1024,
          timeout: 20_000
        }
      );

      const findings: unknown = JSON.parse(
        await readFile(path.join(runDir, "findings.json"), "utf8")
      );
      expect(findings).toMatchObject({
        case_id: "DF-006",
        task_succeeded: true
      });
      expect(JSON.stringify(findings)).toContain('"severity":"P2"');
      expect(JSON.stringify(findings)).not.toMatch(/"severity":"P[01]"/);
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

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
