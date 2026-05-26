import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const gatePath = path.join(root, "goals/7-cli-spec-parity.gates.sh");
const goalPath = path.join(root, "goals/7-cli-spec-parity.md");
const usecasesDir = path.join(root, "docs/usecases");
const honestDir = path.join(root, "apps/cli/tests/e2e-cli-honest");

describe("goal 7 honest UC scope", () => {
  it("derives the honest UC set from docs/usecases with an explicit allow-list", () => {
    const gate = readFileSync(gatePath, "utf8");
    const goal = readFileSync(goalPath, "utf8");
    const documentedUcs = useCaseIds();
    const honestTestUcs = honestUseCaseTestIds();
    const allowList = extractArray(gate, "HONEST_UC_ALLOWLIST");
    const derivedUcs = documentedUcs.filter((uc) => !allowList.includes(uc));

    expect(gate).toContain("docs/usecases");
    expect(gate).toContain("find docs/usecases -name 'UC-*.md'");
    expect(goal).toContain("docs/usecases/UC-*.md");
    expect(goal).toContain("HONEST_UC_ALLOWLIST");
    expect(gate).not.toMatch(/HONEST_UC_SET=\(\n\s+UC-/);
    expect(new Set(allowList).size).toBe(allowList.length);
    expect(derivedUcs).toEqual(honestTestUcs);
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
