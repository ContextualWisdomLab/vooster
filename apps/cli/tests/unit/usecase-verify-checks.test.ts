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
};

type VerifyJson = {
  spec_checks: Array<{
    detail?: string;
    id: string;
    status: "fail" | "pass";
  }>;
  structural_checks: Array<{
    detail: string;
    id: string;
    status: "missing" | "present";
  }>;
  status: string;
};

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("usecase verify spec checks", () => {
  test("human output includes every spec-fidelity check", async () => {
    const root = fixtureRoot();
    stubUsecase(validUsecase());
    const lines: string[] = [];

    await runVerify(flags({ root }), "UC-013", (line) => lines.push(line));

    expect(lines).toContain("Spec actors_registered pass");
    expect(lines).toContain("Spec scenario_completeness pass");
    expect(lines).toContain("Spec extension_points_resolved pass");
    expect(lines).toContain("Spec cockburn_fidelity pass");
    expect(lines).toContain("Structure primary_actor present - Customer");
    expect(lines).toContain("Structure level present - USER_GOAL");
    expect(lines).toContain("Structure stakeholders present - 1 stakeholder interest");
    expect(lines).toContain("Structure extensions present - 1 extension scenario");
    expect(process.exitCode).toBeUndefined();
  });

  test("json output reports every missing structural dimension", async () => {
    const root = fixtureRoot();
    stubUsecase(structurallyIncompleteUsecase());
    const lines: string[] = [];

    await runVerify(flags({ format: "json", root }), "UC-013", (line) =>
      lines.push(line)
    );

    const result = JSON.parse(lines.join("\n")) as VerifyJson;
    expect(result.status).toBe("structural_failed");
    expect(process.exitCode).toBe(1);
    expect(result.structural_checks).toEqual([
      {
        detail: "Primary actor is missing.",
        id: "primary_actor",
        status: "missing"
      },
      {
        detail: "Cockburn level is missing.",
        id: "level",
        status: "missing"
      },
      {
        detail: "No stakeholder interests are attached.",
        id: "stakeholders",
        status: "missing"
      },
      {
        detail: "No extension or alternate scenarios are attached.",
        id: "extensions",
        status: "missing"
      }
    ]);
  });

  test("json output aggregates failing spec checks into the verdict", async () => {
    const root = fixtureRoot();
    stubUsecase(invalidUsecase());
    const lines: string[] = [];

    await runVerify(flags({ format: "json", root }), "UC-013", (line) =>
      lines.push(line)
    );

    const result = JSON.parse(lines.join("\n")) as VerifyJson;
    expect(result.status).toBe("spec_failed");
    expect(process.exitCode).toBe(1);
    expect(result.spec_checks).toEqual([
      expect.objectContaining({ id: "actors_registered", status: "fail" }),
      expect.objectContaining({ id: "scenario_completeness", status: "fail" }),
      expect.objectContaining({ id: "extension_points_resolved", status: "fail" }),
      expect.objectContaining({ id: "cockburn_fidelity", status: "fail" })
    ]);
  });

  test("agent output exposes branchable spec-check detail", async () => {
    const root = fixtureRoot();
    stubUsecase(invalidUsecase());
    const lines: string[] = [];

    await runVerify(flags({ format: "agent", root }), "UC-013", (line) =>
      lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as {
      data: VerifyJson;
    };
    const actorCheck = envelope.data.spec_checks.find(
      (check) => check.id === "actors_registered"
    );

    expect(envelope.data.status).toBe("spec_failed");
    expect(actorCheck).toMatchObject({
      detail: "Unregistered step actors: Unknown",
      status: "fail"
    });
    expect(process.exitCode).toBe(1);
  });
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-verify-checks-"));
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

function validUsecase() {
  return {
    actors: [{ name: "Customer" }],
    primary_actor: { name: "Customer" },
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
      {
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
      }
    ],
    stakeholder_interests: [
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

function structurallyIncompleteUsecase() {
  return {
    actors: [{ name: "Customer" }],
    primary_actor: { name: "" },
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

function invalidUsecase() {
  return {
    actors: [{ name: "Customer" }],
    primary_actor: { name: "Customer" },
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
      {
        extension_point: "9a",
        steps: [
          {
            action: "Receives a fallback.",
            actor: "Unknown",
            implements: ["src/auth/login.ts:loginUser"],
            invokes: [],
            step_number: 1
          }
        ],
        type: "EXTENSION"
      },
      {
        extension_point: "1a",
        steps: [],
        type: "EXTENSION"
      }
    ],
    stakeholder_interests: [
      { interest: "Reliable access.", stakeholder: "Product Manager" }
    ],
    usecase: {
      current_revision_id: "revision-1",
      key: "UC-013",
      level: "USER_GOAL",
      status: "DRAFT",
      title: ""
    }
  };
}
