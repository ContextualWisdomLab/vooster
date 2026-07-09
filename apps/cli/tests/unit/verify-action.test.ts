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
    expect(workflow).toContain(
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
    );
    expect(workflow).toContain(
      "pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa"
    );
    expect(workflow).toContain(
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
    );
    expect(workflow).toContain(
      "actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b"
    );
    expect(workflow).toContain("steps.verify.outputs.exit_code");
    expect(workflow).toContain("steps.verify.outputs.log_path");
  });
});
