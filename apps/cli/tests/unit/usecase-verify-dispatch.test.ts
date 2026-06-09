import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { commandRouteKeys, dispatchCommandRoute } from "../../src/index.js";

const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("usecase verify dispatch", () => {
  test("registers usecase verify as a routed dispatcher key", () => {
    expect(commandRouteKeys()).toContain("usecase verify");
  });

  test("dispatches usecase verify into the shared verify verdict", async () => {
    const root = fixtureRoot();
    stubUsecase(usecaseResponse());
    const lines: string[] = [];

    const handled = await dispatchCommandRoute({
      argv: ["usecase", "verify", "UC-013"],
      cwd: root,
      flags: {
        "api-url": "https://api.example.test",
        root,
        "session-cookie": "session-token"
      },
      writeLine: (line) => lines.push(line)
    });

    expect(handled).toBe(true);
    expect(lines).toContain("Verify UC-013 pass");
    expect(lines).not.toEqual(["vspec CLI"]);
  });
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-usecase-verify-dispatch-"));
  roots.push(root);
  mkdirSync(join(root, "src/auth"), { recursive: true });
  writeFileSync(join(root, "src/auth/login.ts"), "export function loginUser() {}\n");
  return root;
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

function usecaseResponse() {
  return {
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
