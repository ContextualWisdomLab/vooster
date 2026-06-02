import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("verify GitHub Action adapter", () => {
  it("maps vspec verify exit codes through a composite action", () => {
    const action = readFileSync("action.yml", "utf8");

    expect(action).toContain("name: Vooster Verify");
    expect(action).toContain("using: composite");
    expect(action).toContain("usecase-key:");
    expect(action).toContain("test-command:");
    expect(action).toContain("unlinked-policy:");
    expect(action).toContain('node "$GITHUB_ACTION_PATH/apps/cli/bin/run.js" verify');
    expect(action).toContain('--root "$PWD"');
    expect(action).toContain("exit_code=");
    expect(action).toContain("GITHUB_STEP_SUMMARY");
    expect(action).toContain("Vooster verify incomplete coverage");
  });

  it("ships a copy-paste workflow with PR failure surfacing", () => {
    const workflow = readFileSync(".github/workflows/vspec-verify.yml", "utf8");

    expect(workflow).toContain("name: Vspec Verify");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("uses: ./");
    expect(workflow).toContain("usecase-key: ${{ vars.VSPEC_VERIFY_USECASE }}");
    expect(workflow).toContain("actions/github-script@v7");
    expect(workflow).toContain("steps.verify.outputs.exit_code");
    expect(workflow).toContain("steps.verify.outputs.log_path");
  });
});
