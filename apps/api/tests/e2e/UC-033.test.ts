import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type GuideResponse = {
  cache: { cli_version: string; status: string };
  content: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings?: Array<{ message: string; type: string }>;
};
type JsonGuideResponse = {
  examples: Array<{ commands: string[]; title: string }>;
  sections: Array<{ heading: string; body: string }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  version: string;
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.stop();
});

describe("UC-033 - Learn how to use vspec (AI agent)", () => {
  test("MAIN: public markdown guide bootstraps a fresh AI agent", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.0.0", {
      method: "POST"
    });

    expect(response.status).toBe(200);
    const guide = (await response.json()) as GuideResponse;
    expect(guide.cache).toEqual({ cli_version: "1.0.0", status: "REFRESHED" });
    expect(guide.content).toContain("# vspec AI Agent Guide");
    expect(guide.content).toContain("Why sessions exist");
    expect(guide.content).toContain("start a session with `--pin` for every use case");
    expect(guide.content).toContain(
      "Inspect `context`, `suggested_next_actions`, `warnings`, and `format_version`"
    );
    expect(guide.content).toContain("Forbidden actions");
    expect(guide.content).toContain("Never force a merge");
    expect(guide.content).toContain("Greenfield setup");
    expect(guide.content).toContain("If `vspec status` already shows");
    expect(guide.content).toContain("vspec project create --key POCKET");
    expect(guide.content).toContain("vspec init --project POCKET");
    expect(guide.content).toContain(
      'vspec actor create --name "Pocket" --type SUPPORTING'
    );
    expect(guide.content).toContain("vspec usecase add-stakeholder");
    expect(guide.content).toContain("vspec scenario add POCKET-001");
    expect(guide.content).toContain("Existing use case edits");
    expect(guide.content).toContain(
      "step ids in `vspec usecase show <KEY-NNN> --format=agent`"
    );
    expect(guide.content).toContain("`data.usecase.current_revision_id`");
    expect(guide.content).toContain("Use `vspec step add --at <n>`");
    expect(guide.content).toContain(
      "vspec scenario add POCKET-001 --type EXTENSION --at 2a"
    );
    expect(guide.content).toContain(
      'vspec session start --intent "Update checkout copy" --pin PAY-001'
    );
    expect(guide.suggested_next_actions).toEqual([
      {
        command: "vspec login",
        reason: "Authenticate before working with private specs."
      },
      { command: "vspec project list", reason: "Find the project to inspect." },
      {
        command: "vspec session start",
        reason: "Pin the target use cases before editing."
      }
    ]);
  });

  test("1a: JSON format returns structured guide content", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.0.0&format=json", {
      method: "POST"
    });

    expect(response.status).toBe(200);
    const guide = (await response.json()) as JsonGuideResponse;
    expect(guide.version).toBe("1.0.0");
    expect(guide.sections.map((section) => section.heading)).toEqual([
      "Why sessions exist",
      "Mandatory workflow",
      "Greenfield setup",
      "Existing use case edits",
      "The --format=agent payload contract",
      "Forbidden actions",
      "Worked example"
    ]);
    expect(guide.sections.at(1)?.body).toContain("start a session with --pin");
    expect(guide.sections.at(2)?.body).toContain("vspec project create --key POCKET");
    expect(guide.sections.at(2)?.body).toContain("do not run vspec login again");
    expect(guide.sections.at(2)?.body).toContain(
      "vspec scenario add POCKET-001 --type EXTENSION --at 2a"
    );
    expect(guide.sections.at(3)?.body).toContain("step ids");
    expect(guide.sections.at(3)?.body).toContain("current_revision_id");
    expect(guide.sections.at(4)?.body).toContain("suggested_next_actions");
    expect(guide.examples).toContainEqual({
      title: "First pinned edit",
      commands: [
        "vspec login",
        "vspec project list",
        "vspec project create --key POCKET --name Pocket",
        "vspec init --project POCKET",
        'vspec actor create --name "Account Holder" --type PRIMARY',
        'vspec actor create --name "Pocket" --type SUPPORTING',
        'vspec stakeholder create --name "Account Holder" --type EXTERNAL',
        'vspec usecase create --title "User logs a new expense" --primary-actor "Account Holder" --format=agent',
        'vspec usecase add-stakeholder POCKET-001 --stakeholder "Account Holder" --interest "Accurate confirmed expense records"',
        "vspec scenario add POCKET-001 --type MAIN_SUCCESS --outcome SUCCESS",
        'vspec step add <main-scenario-id> --actor "Account Holder" --action "enters the expense amount, selects a category, and optionally adds a note"',
        'vspec step add <main-scenario-id> --actor "Pocket" --action "validates the amount is positive and the category is selected"',
        'vspec scenario add POCKET-001 --type EXTENSION --at 2a --condition "Amount is missing or invalid" --outcome FAILURE',
        'vspec session start --intent "Update checkout copy" --pin PAY-001',
        "vspec usecase show PAY-001 --format=agent",
        "vspec change propose --usecase PAY-001 --summary ..."
      ]
    });
    expect(guide.suggested_next_actions[0]).toEqual({
      command: "vspec login",
      reason: "Authenticate before working with private specs."
    });
  });

  test("3a: network failure falls back to previous cached guide with warning", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.0.0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cached_guides: [
          { cli_version: "0.9.0", content: "# Old vspec AI Agent Guide\n" }
        ],
        simulate_network_failure: true
      })
    });

    expect(response.status).toBe(200);
    const guide = (await response.json()) as GuideResponse;
    expect(guide.cache).toEqual({ cli_version: "0.9.0", status: "STALE_FALLBACK" });
    expect(guide.content).toContain("WARNING: this guide may be out of date");
    expect(guide.content).toContain("# Old vspec AI Agent Guide");
    expect(guide.warnings).toContainEqual({
      type: "STALE_AI_GUIDE",
      message:
        "Using cached guide 0.9.0 because the current guide could not be fetched."
    });
    expect(guide.suggested_next_actions).toContainEqual({
      command: "vspec ai-guide",
      reason: "Retry once connectivity returns."
    });
  });

  test("2a: upgraded CLI force-refreshes mismatched cached guide", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.1.0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cached_guides: [{ cli_version: "1.0.0", content: "# Old cached guide\n" }]
      })
    });

    expect(response.status).toBe(200);
    const guide = (await response.json()) as GuideResponse;
    expect(guide.cache).toEqual({
      cli_version: "1.1.0",
      previous_cli_version: "1.0.0",
      status: "REFRESHED_VERSION_MISMATCH"
    });
    expect(guide.content).toContain("# vspec AI Agent Guide");
    expect(guide.content).not.toContain("Old cached guide");
  });

  test("*a: cold offline start returns exit code 5 and public guide URL", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.0.0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulate_network_failure: true })
    });

    expect(response.status).toBe(503);
    const problem = (await response.json()) as {
      bootstrap: string;
      exit_code: number;
      title: string;
    };
    expect(problem.title).toMatch(/ai guide unavailable/i);
    expect(problem.exit_code).toBe(5);
    expect(problem.bootstrap).toBe(
      "Read https://vspec.dev/ai-guide and retry vspec ai-guide once online."
    );
  });
});
