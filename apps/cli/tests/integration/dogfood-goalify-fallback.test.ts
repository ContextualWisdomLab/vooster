import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood goalify fallback", () => {
  it("adopts a fallback goal when claude returns a malformed draft", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-goalify-"));
    const bin = path.join(tmp, "bin");
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const cycle = "cycle-goalify";
    const runDir = path.join(runsDir, cycle, "DF-001");

    try {
      await mkdir(runDir, { recursive: true });
      await createMalformedClaude(bin);
      await writeFile(
        path.join(runDir, "findings.json"),
        JSON.stringify({
          case_id: "DF-001",
          summary: "fallback",
          task_succeeded: false,
          findings: [
            {
              evidence: "test evidence",
              quants: ["A", "T"],
              recommendation: "test recommendation",
              root_cause_area: "apps/cli/src",
              routing: "codex",
              severity: "P1",
              title: "Goalify fallback test budget"
            }
          ]
        })
      );

      await execFileAsync("bash", ["scripts/dogfood/dogfood-goalify.sh", cycle], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          VSPEC_DOGFOOD_RUNS_DIR: runsDir,
          VSPEC_DOGFOOD_STATE_DIR: stateDir
        },
        maxBuffer: 1024 * 1024,
        timeout: 30_000
      });

      const spawned = await import("node:fs/promises").then(({ readFile }) =>
        readFile(path.join(stateDir, "spawned-goals"), "utf8")
      );
      expect(spawned).toMatch(/goals\/[0-9]+-dogfood-goalify-fallback-test-budget\.md/);
    } finally {
      await cleanupGeneratedFallbackFiles();
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

async function createMalformedClaude(bin: string): Promise<void> {
  await mkdir(bin, { recursive: true });
  await writeFile(
    path.join(bin, "claude"),
    "#!/usr/bin/env bash\nprintf 'not json\\n'\n",
    {
      mode: 0o755
    }
  );
}

async function cleanupGeneratedFallbackFiles(): Promise<void> {
  await execFileAsync(
    "bash",
    [
      "-lc",
      [
        "rm -f docs/findings/*goalify-fallback-test-budget*.md",
        "rm -f goals/*-dogfood-goalify-fallback-test-budget.md",
        "rm -f goals/*-dogfood-goalify-fallback-test-budget.gates.sh",
        "rm -f goals/*-dogfood-goalify-fallback-test-budget.next-task.sh"
      ].join("; ")
    ],
    { cwd: root }
  );
}
