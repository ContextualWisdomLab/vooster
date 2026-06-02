import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runVerify } from "../../src/commands/verify.js";

type VerifyFlags = {
  "api-url"?: string;
  format?: string;
  root?: string;
  "session-cookie"?: string;
  "test-cmd"?: string;
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

describe("verify command", () => {
  test("passes when every implementation link resolves", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse());
    const lines: string[] = [];

    await runVerify(flags({ root }), "UC-013", (line) => lines.push(line));

    expect(process.exitCode).toBeUndefined();
    expect(lines).toEqual([
      "Verify UC-013 pass",
      "Checked refs 2",
      "Broken links 0",
      "Unlinked steps 0",
      "Tests not run"
    ]);
    rmSync(root, { recursive: true });
  });

  test("reports broken file and symbol links with exit code 1", async () => {
    const root = fixtureRoot();
    stubUsecase(
      usecaseResponse({
        implements: [
          "src/auth/login.ts:missingSymbol",
          "tests/UC-013.feature:scenario_missing",
          "src/missing.ts"
        ]
      })
    );
    const lines: string[] = [];

    await runVerify(flags({ root }), "UC-013", (line) => lines.push(line));

    expect(process.exitCode).toBe(1);
    expect(lines).toEqual([
      "Verify UC-013 broken_links",
      "Checked refs 3",
      "Broken links 3",
      "Unlinked steps 0",
      "Broken UC-013#1 src/auth/login.ts:missingSymbol missing_symbol",
      "Broken UC-013#1 src/missing.ts missing_file",
      "Broken UC-013#1 tests/UC-013.feature:scenario_missing missing_symbol",
      "Tests not run"
    ]);
    rmSync(root, { recursive: true });
  });

  test("reports unlinked steps with exit code 7", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse({ implements: [] }));
    const lines: string[] = [];

    await runVerify(flags({ root }), "UC-013", (line) => lines.push(line));

    expect(process.exitCode).toBe(7);
    expect(lines).toEqual([
      "Verify UC-013 unlinked_steps",
      "Checked refs 0",
      "Broken links 0",
      "Unlinked steps 1",
      "Unlinked UC-013#1 Logs the user in.",
      "Tests not run"
    ]);
    rmSync(root, { recursive: true });
  });

  test("delegates linked test execution and maps failure to exit code 1", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse());
    const lines: string[] = [];

    await runVerify(
      flags({ root, "test-cmd": `${process.execPath} -e "process.exit(1)"` }),
      "UC-013",
      (line) => lines.push(line)
    );

    expect(process.exitCode).toBe(1);
    expect(lines).toContain("Verify UC-013 failing_tests");
    expect(lines).toContain("Tests failed 1");
    rmSync(root, { recursive: true });
  });

  test("emits deterministic json for repeated runs on the same input", async () => {
    const root = fixtureRoot();
    const outputs: string[] = [];
    const exitCodes: Array<NodeJS.Process["exitCode"]> = [];

    for (let index = 0; index < 10; index += 1) {
      stubUsecase(usecaseResponse({ implements: ["src/missing.ts"] }));
      const lines: string[] = [];
      await runVerify(flags({ format: "json", root }), "UC-013", (line) =>
        lines.push(line)
      );
      outputs.push(lines.join("\n"));
      exitCodes.push(process.exitCode);
      process.exitCode = undefined;
    }

    expect(new Set(outputs).size).toBe(1);
    expect(new Set(exitCodes).size).toBe(1);
    expect(exitCodes[0]).toBe(1);
    rmSync(root, { recursive: true });
  });

  test("agent output exposes deterministic drift kinds only", async () => {
    const root = fixtureRoot();
    const driftKinds = new Set<string>();

    stubUsecase(usecaseResponse({ implements: ["src/missing.ts"] }));
    let lines: string[] = [];
    await runVerify(flags({ format: "agent", root }), "UC-013", (line) =>
      lines.push(line)
    );
    driftKinds.add(agentDriftKind(lines));
    process.exitCode = undefined;

    stubUsecase(usecaseResponse({ implements: [] }));
    lines = [];
    await runVerify(flags({ format: "agent", root }), "UC-013", (line) =>
      lines.push(line)
    );
    driftKinds.add(agentDriftKind(lines));
    process.exitCode = undefined;

    stubUsecase(usecaseResponse());
    lines = [];
    await runVerify(
      flags({
        format: "agent",
        root,
        "test-cmd": `${process.execPath} -e "process.exit(1)"`
      }),
      "UC-013",
      (line) => lines.push(line)
    );
    driftKinds.add(agentDriftKind(lines));

    expect([...driftKinds].sort()).toEqual([
      "broken_link",
      "failing_test",
      "unlinked_step"
    ]);
    rmSync(root, { recursive: true });
  });
});

function agentDriftKind(lines: string[]): string {
  const envelope = JSON.parse(lines.join("\n")) as {
    data: { drift: Array<{ kind: string }> };
  };
  return envelope.data.drift[0]?.kind ?? "";
}

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-verify-"));
  mkdirSync(join(root, "src/auth"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  writeFileSync(join(root, "src/auth/login.ts"), "export function loginUser() {}\n");
  writeFileSync(join(root, "tests/UC-013.feature"), "Scenario: scenario_login\n");
  return root;
}

function flags(overrides: VerifyFlags = {}): VerifyFlags {
  return {
    "api-url": "https://api.example.test",
    root: process.cwd(),
    "session-cookie": "session-token",
    ...overrides
  };
}

function stubUsecase(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(body),
        ok: true
      } as Response)
    )
  );
}

function usecaseResponse(overrides: { implements?: string[] } = {}) {
  return {
    scenarios: [
      {
        steps: [
          {
            action: "Logs the user in.",
            actor: "Customer",
            implements: overrides.implements ?? [
              "src/auth/login.ts:loginUser",
              "tests/UC-013.feature:scenario_login"
            ],
            invokes: [],
            step_number: 1
          }
        ],
        type: "MAIN_SUCCESS"
      }
    ],
    stakeholder_interests: [],
    usecase: {
      current_revision_id: "revision-1",
      key: "UC-013",
      status: "DRAFT",
      title: "Logs the user in"
    }
  };
}
