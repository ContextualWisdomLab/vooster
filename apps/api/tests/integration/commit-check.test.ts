import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("commit-check", () => {
  it("runs hygiene checks and the closest unit test for staged API application code", async () => {
    const result = await commitCheck(["apps/api/src/application/actors.ts"]);

    expect(result.stdout).toContain(
      "pnpm exec prettier --check --ignore-unknown apps/api/src/application/actors.ts"
    );
    expect(result.stdout).toContain(
      "pnpm exec eslint --max-warnings 0 apps/api/src/application/actors.ts"
    );
    expect(result.stdout).toContain(
      "pnpm exec vitest run apps/api/tests/unit/application/actors.test.ts"
    );
    expect(result.stdout).not.toContain("completion-check.sh");
  });

  it("runs the matching goal rigor and fast goal gate for staged goal edits", async () => {
    const result = await commitCheck(["goals/12-branch-agent-format.gates.sh"]);

    expect(result.stdout).toContain(
      "bash scripts/check-gate-rigor.sh goals/12-branch-agent-format.md"
    );
    expect(result.stdout).toContain(
      "VSPEC_GATES_SKIP_DEEP=1 bash goals/12-branch-agent-format.gates.sh"
    );
    expect(result.stdout).not.toContain("bash scripts/completion-check.sh");
  });

  it("allows broad changes after warning that the full regression gate must run before push or merge", async () => {
    const result = await commitCheck(["package.json"]);

    expect(result.stdout).toContain("full regression required before push/merge");
    expect(result.stdout).toContain("bash scripts/completion-check.sh");
  });

  it("detects unknown staged impact and asks for the full regression gate", async () => {
    const result = await commitCheck(["tools/new-generator.ts"]);

    expect(result.stdout).toContain("Unknown staged impact:");
    expect(result.stdout).toContain("tools/new-generator.ts");
    expect(result.stdout).toContain("bash scripts/completion-check.sh");
  });

  it("blocks staged secrets and generated artifacts", async () => {
    await expectCommitCheckFailure([".env"], "staged secret/local config file");

    await expectCommitCheckFailure(
      ["apps/api/dist/index.js"],
      "staged generated artifact"
    );
  });

  it("uses commit-check from the pre-commit hook instead of the full completion sweep", () => {
    const hook = readFileSync("scripts/hooks/pre-commit", "utf8");

    expect(hook).toContain("scripts/commit-check.sh");
    expect(hook).not.toContain("scripts/completion-check.sh");
  });
});

async function commitCheck(stagedFiles: string[]) {
  return execFileAsync("bash", ["scripts/commit-check.sh"], {
    cwd: root,
    env: {
      ...process.env,
      VSPEC_COMMIT_CHECK_DRY_RUN: "1",
      VSPEC_COMMIT_CHECK_STAGED_FILES: stagedFiles.join("\n")
    },
    maxBuffer: 1024 * 1024
  });
}

async function expectCommitCheckFailure(
  stagedFiles: string[],
  message: string
): Promise<void> {
  try {
    await commitCheck(stagedFiles);
    throw new Error("commit-check unexpectedly passed");
  } catch (error: unknown) {
    if (!hasStdout(error)) {
      throw error;
    }

    expect(error.stdout).toContain(message);
  }
}

function hasStdout(error: unknown): error is { stdout: string } {
  return typeof error === "object" && error !== null && "stdout" in error;
}
