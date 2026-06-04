import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood clean pass cap handling", () => {
  it("lets a clean triage pass exit 0 even when the current cycle reaches the cap", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-clean-"));
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const cycle = "cycle-clean";
    const blockersPath = path.join(root, "docs/state/blockers.md");
    const blockersBefore = await readFile(blockersPath, "utf8");

    try {
      await writeP2OnlyFindings(runsDir, cycle);

      const { stdout } = await execFileAsync(
        "bash",
        ["scripts/dogfood/dogfood-triage.sh", cycle],
        {
          cwd: root,
          env: {
            ...process.env,
            VSPEC_DOGFOOD_BUDGET_USD: "999",
            VSPEC_DOGFOOD_MAX_CYCLES: "1",
            VSPEC_DOGFOOD_RUNS_DIR: runsDir,
            VSPEC_DOGFOOD_STATE_DIR: stateDir
          },
          maxBuffer: 1024 * 1024
        }
      );

      expect(stdout).toContain("clean pass");
      await expect(readFile(blockersPath, "utf8")).resolves.toBe(blockersBefore);
    } finally {
      await writeFile(blockersPath, blockersBefore);
      await rm(tmp, { force: true, recursive: true });
    }
  });

  it("lets the cycle entrypoint stop on an already recorded clean pass before preflight cap", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-clean-"));
    const stateDir = path.join(tmp, "state");
    const runsDir = path.join(tmp, "runs");
    const cycle = "cycle-clean";
    const findingSlug = "non-blocking-dogfood-debt";
    const blockersPath = path.join(root, "docs/state/blockers.md");
    const blockersBefore = await readFile(blockersPath, "utf8");

    try {
      await cleanupFindings(findingSlug);
      await mkdir(stateDir, { recursive: true });
      await writeP2OnlyFindings(runsDir, cycle);
      await writeFile(path.join(stateDir, "cycle"), `${cycle}\n`);
      await writeFile(
        path.join(stateDir, "ledger.tsv"),
        `2026-06-02T00:00:00Z\t${cycle}\ttriage\t0\tP0=0 P1=0 P2=1\n`
      );

      const { stdout } = await execFileAsync(
        "bash",
        ["scripts/dogfood/dogfood-cycle.sh"],
        {
          cwd: root,
          env: {
            ...process.env,
            VSPEC_DOGFOOD_BUDGET_USD: "999",
            VSPEC_DOGFOOD_MAX_CYCLES: "1",
            VSPEC_DOGFOOD_RUNS_DIR: runsDir,
            VSPEC_DOGFOOD_STATE_DIR: stateDir
          },
          maxBuffer: 1024 * 1024
        }
      );

      expect(stdout).toContain("clean pass");
      const findingFiles = await findingFilesFor(findingSlug);
      expect(findingFiles).toHaveLength(1);
      const findingFile = findingFiles[0];
      if (findingFile === undefined) {
        throw new Error("expected one P2 dogfood finding document");
      }
      const finding = await readFile(findingFile, "utf8");
      expect(finding).toContain("priority: P2");
      expect(finding).toContain("source: dogfood-loop cycle cycle-clean");
      await expect(readFile(blockersPath, "utf8")).resolves.toBe(blockersBefore);
    } finally {
      await cleanupFindings(findingSlug);
      await writeFile(blockersPath, blockersBefore);
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

async function writeP2OnlyFindings(runsDir: string, cycle: string): Promise<void> {
  const runDir = path.join(runsDir, cycle, "DF-001");
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(runDir, "findings.json"),
    JSON.stringify({
      case_id: "DF-001",
      findings: [
        {
          evidence: "successful run with non-blocking debt",
          quants: ["A"],
          recommendation: "track as debt",
          root_cause_area: "docs",
          routing: "codex",
          severity: "P2",
          title: "Non-blocking dogfood debt"
        }
      ],
      task_succeeded: true
    })
  );
}

async function findingFilesFor(slug: string): Promise<string[]> {
  const dir = path.join(root, "docs/findings");
  const files = await readdir(dir);
  return files
    .filter((file) => file.includes(slug) && file.endsWith(".md"))
    .map((file) => path.join(dir, file));
}

async function cleanupFindings(slug: string): Promise<void> {
  for (const file of await findingFilesFor(slug)) {
    await rm(file, { force: true });
  }
}
