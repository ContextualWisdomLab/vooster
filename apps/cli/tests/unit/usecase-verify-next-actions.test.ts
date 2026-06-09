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

type SuggestedAction = {
  command: string;
  reason?: string;
};

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("usecase verify next actions", () => {
  test("agent output includes one suggestion per failing check", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseWithMultipleFailures());
    const lines: string[] = [];

    await runVerify(flags({ format: "agent", root }), "UC-013", (line) =>
      lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as {
      data: { suggested_next_actions: SuggestedAction[] };
      suggested_next_actions: SuggestedAction[];
    };

    expect(envelope.suggested_next_actions).toEqual(expectedFailureActions());
    expect(envelope.data.suggested_next_actions).toEqual(
      envelope.suggested_next_actions
    );
    expect(process.exitCode).toBe(1);
  });

  test("human output prints the same suggestions inline", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseWithMultipleFailures());
    const lines: string[] = [];

    await runVerify(flags({ root }), "UC-013", (line) => lines.push(line));

    expect(lines).toContain("Next actions");
    for (const action of expectedFailureActions()) {
      expect(lines).toContain(`  ${action.command} - ${action.reason ?? ""}`);
    }
  });

  test("json output carries suggestions and clean verdicts carry none", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseWithFailingSpecCheck());
    let lines: string[] = [];

    await runVerify(flags({ format: "json", root }), "UC-013", (line) =>
      lines.push(line)
    );

    const failing = JSON.parse(lines.join("\n")) as {
      suggested_next_actions: SuggestedAction[];
    };
    expect(failing.suggested_next_actions).toEqual([
      {
        command: "vspec usecase show UC-013 --format=agent",
        reason:
          "Resolve spec check actors_registered: Unregistered step actors: Unknown"
      }
    ]);

    process.exitCode = undefined;
    stubUsecase(completeUsecase());
    lines = [];

    await runVerify(flags({ format: "json", root }), "UC-013", (line) =>
      lines.push(line)
    );

    const passing = JSON.parse(lines.join("\n")) as {
      suggested_next_actions: SuggestedAction[];
    };
    expect(passing.suggested_next_actions).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });

  test("failing delegated tests suggest rerunning the command", async () => {
    const root = fixtureRoot();
    const command = `${process.execPath} -e "process.exit(1)"`;
    stubUsecase(completeUsecase());
    const lines: string[] = [];

    await runVerify(
      flags({ format: "json", root, "test-cmd": command }),
      "UC-013",
      (line) => lines.push(line)
    );

    const result = JSON.parse(lines.join("\n")) as {
      suggested_next_actions: SuggestedAction[];
    };
    expect(result.suggested_next_actions).toEqual([
      {
        command,
        reason:
          "Rerun the failing verification test command after fixing implementation drift."
      }
    ]);
  });
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-verify-next-actions-"));
  roots.push(root);
  mkdirSync(join(root, "src/auth"), { recursive: true });
  writeFileSync(join(root, "src/auth/login.ts"), "export function loginUser() {}\n");
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

function expectedFailureActions(): SuggestedAction[] {
  return [
    {
      command: "vspec usecase show UC-013 --format=agent",
      reason: "Fix step 1 implementation ref src/missing.ts (missing_file)."
    },
    {
      command: "vspec usecase show UC-013 --format=agent",
      reason: "Add an implements ref to step 2: Confirms the login."
    },
    {
      command:
        "vspec usecase add-stakeholder UC-013 --stakeholder <name> --interest <interest> --format=agent",
      reason: "Attach at least one stakeholder interest."
    },
    {
      command:
        'vspec scenario add UC-013 --type EXTENSION --extension-point 1a --condition "<condition>" --outcome FAILURE --format=agent',
      reason:
        "Add an extension or alternate scenario, or confirm none are needed outside verify."
    }
  ];
}

function usecaseWithMultipleFailures() {
  return baseUsecase({
    scenarios: [
      {
        steps: [
          {
            action: "Logs the user in.",
            actor: "Customer",
            implements: ["src/missing.ts"],
            invokes: [],
            step_number: 1
          },
          {
            action: "Confirms the login.",
            actor: "Customer",
            implements: [],
            invokes: [],
            step_number: 2
          }
        ],
        type: "MAIN_SUCCESS"
      }
    ],
    stakeholder_interests: []
  });
}

function usecaseWithFailingSpecCheck() {
  return baseUsecase({
    scenarios: [
      {
        steps: [
          {
            action: "Logs the user in.",
            actor: "Unknown",
            implements: ["src/auth/login.ts:loginUser"],
            invokes: [],
            step_number: 1
          }
        ],
        type: "MAIN_SUCCESS"
      },
      extensionScenario()
    ]
  });
}

function completeUsecase() {
  return baseUsecase({
    scenarios: [
      {
        steps: [
          {
            action: "Logs the user in.",
            actor: "Customer",
            implements: ["src/auth/login.ts:loginUser"],
            invokes: [],
            step_number: 1
          }
        ],
        type: "MAIN_SUCCESS"
      },
      extensionScenario()
    ]
  });
}

function baseUsecase(
  overrides: Partial<{
    scenarios: unknown[];
    stakeholder_interests: unknown[];
  }> = {}
) {
  return {
    actors: [{ name: "Customer" }],
    primary_actor: { name: "Customer" },
    scenarios: overrides.scenarios ?? [],
    stakeholder_interests: overrides.stakeholder_interests ?? [
      { interest: "Reliable access.", stakeholder: "Product Manager" }
    ],
    usecase: {
      current_revision_id: "revision-1",
      key: "UC-013",
      level: "USER_GOAL",
      status: "DRAFT",
      title: "Logs the user in"
    }
  };
}

function extensionScenario() {
  return {
    extension_point: "1a",
    steps: [
      {
        action: "Receives a fallback code.",
        actor: "Customer",
        implements: ["src/auth/login.ts:loginUser"],
        invokes: [],
        step_number: 2
      }
    ],
    type: "EXTENSION"
  };
}
