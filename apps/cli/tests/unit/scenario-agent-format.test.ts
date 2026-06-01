import { afterEach, describe, expect, test, vi } from "vitest";

import { runScenario } from "../../src/commands/scenario.js";

type ScenarioAgentEnvelope = {
  affected_files?: unknown[];
  context: {
    revision: null | string;
  };
  data: {
    revision: {
      id: string;
      severity: string;
      version_number: number;
    };
    scenario: {
      id: string;
      outcome: string;
      type: string;
    };
    steps?: unknown[];
  };
  dry_run?: boolean;
  format_version: 1;
  status?: "ok" | "error";
  suggested_next_actions: unknown[];
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scenario add --format=agent", () => {
  test("agent scenario add", async () => {
    stubFetch(scenarioBody());
    const lines: string[] = [];

    await runScenario(scenarioFlags({ format: "agent" }), "add", "UC-001", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("Scenario ");
    expect(stdout).not.toContain("Type ");
    expect(stdout).not.toContain("Outcome ");
    expect(stdout).not.toContain("Revision ");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.scenario.id).toBe("scenario-1");
    expect(envelope.data.revision.id).toBe("revision-1");
    expect(envelope.context.revision).toBe("revision-1");
  });

  test("human scenario add", async () => {
    stubFetch(scenarioBody());
    const lines: string[] = [];

    await runScenario(scenarioFlags(), "add", "UC-001", (line) => lines.push(line));

    expect(lines).toContain("Scenario scenario-1");
    expect(lines).toContain("Type MAIN_SUCCESS");
    expect(lines).toContain("Outcome SUCCESS");
    expect(lines).toContain("Revision NON_BREAKING version 3");
  });
});

function stubFetch(body: unknown): void {
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

function scenarioFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    type: "main-success",
    ...overrides
  };
}

function scenarioBody() {
  return {
    revision: {
      id: "revision-1",
      severity: "NON_BREAKING",
      version_number: 3
    },
    scenario: {
      condition: null,
      extension_point: null,
      id: "scenario-1",
      outcome: "SUCCESS",
      type: "MAIN_SUCCESS"
    },
    steps: []
  };
}

function expectAgentEnvelope(stdout: string): ScenarioAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as ScenarioAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
