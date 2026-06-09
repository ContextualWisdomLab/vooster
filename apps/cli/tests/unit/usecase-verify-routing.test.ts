import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runUsecase } from "../../src/commands/usecase.js";

type VerifyEnvelope = {
  data: {
    status: string;
  };
};

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("usecase verify routing", () => {
  test("routes human output into the shared verify verdict", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse());
    const lines: string[] = [];

    await runUsecase(flags(root), "verify", "UC-013", (line) => lines.push(line));

    expect(process.exitCode).toBeUndefined();
    expect(lines[0]).toBe("Verify UC-013 pass");
    expect(lines).not.toEqual(["vspec CLI"]);
  });

  test("routes json output into the shared verify verdict", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse());
    const lines: string[] = [];

    await runUsecase(flags(root, { format: "json" }), "verify", "UC-013", (line) =>
      lines.push(line)
    );

    const result = JSON.parse(lines.join("\n")) as { status: string };
    expect(result.status).toBe("pass");
  });

  test("routes agent output into the shared verify verdict", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse({ implements: [] }));
    const lines: string[] = [];

    await runUsecase(flags(root, { format: "agent" }), "verify", "UC-013", (line) =>
      lines.push(line)
    );

    const envelope = JSON.parse(lines.join("\n")) as VerifyEnvelope;
    expect(envelope.data.status).toBe("unlinked_steps");
    expect(process.exitCode).toBe(7);
  });
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-usecase-verify-"));
  roots.push(root);
  mkdirSync(join(root, "src/auth"), { recursive: true });
  writeFileSync(join(root, "src/auth/login.ts"), "export function loginUser() {}\n");
  return root;
}

function flags(
  root: string,
  overrides: Record<string, string> = {}
): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    root,
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
    primary_actor: { name: "Customer" },
    scenarios: [
      {
        steps: [
          {
            action: "Logs the user in.",
            actor: "Customer",
            implements: overrides.implements ?? ["src/auth/login.ts:loginUser"],
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
      current_revision_id: "rev-1",
      format: "BRIEF",
      key: "UC-013",
      level: "USER_GOAL",
      priority: "P1",
      scope: "checkout",
      status: "DRAFT",
      title: "Logs in"
    }
  };
}
