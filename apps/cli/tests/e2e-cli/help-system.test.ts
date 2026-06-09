import { describe, expect, test } from "vitest";

import { runCli } from "./helpers.js";

describe("CLI help system", () => {
  test("root help groups commands instead of dumping every flag", async () => {
    const result = await runCli(["--help"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("COMMAND GROUPS");
    expect(result.stdout).toContain("Project");
    expect(result.stdout).toContain("AI");
    expect(result.stdout).toContain("ai-guide");
    expect(result.stdout).toContain("Locks");
    expect(result.stdout).toContain("vspec help <command>");
    expect(result.stdout).not.toContain("--actor-id");
  });

  test("help command routes to command-specific help", async () => {
    const result = await runCli(["help", "lock", "release"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("USAGE");
    expect(result.stdout).toContain("$ vspec lock release <lock-id>");
    expect(result.stdout).toContain("--format=<human|agent>");
  });

  test("command --help routes to the same command-specific help", async () => {
    const result = await runCli(["usecase", "create", "--help"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("USAGE");
    expect(result.stdout).toContain("$ vspec usecase create --title <text>");
    expect(result.stdout).toContain("--primary-actor=<name>");
  });

  test("greenfield authoring help exposes the flags agents need", async () => {
    const scenario = await runCli(["help", "scenario", "add"]);
    const step = await runCli(["help", "step", "add"]);
    const stepEdit = await runCli(["help", "step", "edit"]);
    const interest = await runCli(["help", "usecase", "add-stakeholder"]);
    const stakeholder = await runCli(["help", "stakeholder", "create"]);

    expect(scenario.stdout).toContain("--at=<extension-point>");
    expect(scenario.stdout).toContain("2a");
    expect(scenario.stdout).toContain("--condition=<text>");
    expect(step.stdout).toContain("--actor=<name>");
    expect(step.stdout).toContain("append");
    expect(step.stdout).toContain("--force");
    expect(stepEdit.stdout).toContain("--base-revision=<revision-id>");
    expect(stepEdit.stdout).toContain("step id from usecase show");
    expect(interest.stdout).toContain("--stakeholder=<name>");
    expect(interest.stdout).toContain("--interest=<text>");
    expect(stakeholder.stdout).toContain("--type=<INTERNAL|EXTERNAL|REGULATORY>");
  });
});
