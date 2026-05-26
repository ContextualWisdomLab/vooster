import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../../../..");
const gatePath = path.join(root, "goals/7-cli-spec-parity.gates.sh");
const goalPath = path.join(root, "goals/7-cli-spec-parity.md");
const helperPath = path.join(root, "scripts/derive-honest-uc-set.sh");
const usecasesDir = path.join(root, "docs/usecases");
const honestDir = path.join(root, "apps/cli/tests/e2e-cli-honest");
const fixtureRoot = path.join(tmpdir(), "vooster-goal7-honest-uc-set-test");

describe("goal 7 honest UC scope", () => {
  it("derives the honest UC set from docs/usecases with an explicit allow-list", () => {
    const gate = readFileSync(gatePath, "utf8");
    const goal = readFileSync(goalPath, "utf8");
    const documentedUcs = useCaseIds();
    const honestTestUcs = honestUseCaseTestIds();
    const allowList = extractArray(gate, "HONEST_UC_ALLOWLIST");
    const derivedUcs = documentedUcs.filter((uc) => !allowList.includes(uc));

    expect(gate).toContain("docs/usecases");
    expect(gate).toContain("scripts/derive-honest-uc-set.sh");
    expect(goal).toContain("docs/usecases/UC-*.md");
    expect(goal).toContain("HONEST_UC_ALLOWLIST");
    expect(gate).not.toMatch(/HONEST_UC_SET=\(\n\s+UC-/);
    expect(new Set(allowList).size).toBe(allowList.length);
    expect(derivedUcs).toEqual(honestTestUcs);
  });

  it("keeps the derivation helper data-driven", async () => {
    const docsDir = path.join(fixtureRoot, "usecases");
    await rm(fixtureRoot, { force: true, recursive: true });
    await mkdir(docsDir, { recursive: true });
    await writeFile(path.join(docsDir, "UC-003-third.md"), "# Third\n");
    await writeFile(path.join(docsDir, "UC-001-first.md"), "# First\n");
    await writeFile(path.join(docsDir, "UC-002-second.md"), "# Second\n");

    const result = await execFileAsync("bash", [helperPath, docsDir, "UC-002"], {
      cwd: root
    });

    expect(result.stdout.trim().split("\n")).toEqual(["UC-001", "UC-003"]);
  });
});

function useCaseIds(): string[] {
  return readdirSync(usecasesDir)
    .map((name) => /^UC-\d+/.exec(name)?.[0])
    .filter((id): id is string => id !== undefined)
    .sort();
}

function honestUseCaseTestIds(): string[] {
  return readdirSync(honestDir)
    .map((name) => /^UC-\d+/.exec(name)?.[0])
    .filter((id): id is string => id !== undefined)
    .sort();
}

function extractArray(source: string, name: string): string[] {
  const match = new RegExp(`${name}=\\(([^)]*)\\)`, "m").exec(source);
  if (match === null || match[1] === undefined) {
    throw new Error(`${name} block not found`);
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .sort();
}
