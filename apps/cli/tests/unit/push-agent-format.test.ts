import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runPush } from "../../src/commands/push.js";

type AgentEnvelope<TData> = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: unknown[];
};

type PushData = {
  cache: {
    entries: Array<{
      path: string;
      revision: string;
      status: string;
    }>;
  };
  results: Array<{
    current_revision: string;
    dry_run?: boolean;
    path: string;
    status: string;
  }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

const tempRoots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("push --format=agent", () => {
  test("agent push", async () => {
    const root = tempRoot();
    writeSpec(root, "rev-1", "# Pays an invoice");
    writeUnmanagedNote(root);
    stubFetch(pushResponse());
    const lines: string[] = [];

    await runPush(syncFlags(root, { format: "agent" }), (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<PushData>(stdout);
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.data.results.at(0)?.current_revision).toBe("rev-2");
    expect(envelope.data.cache.entries.at(0)?.status).toBe("SYNCED");
    expect(envelope.data.suggested_next_actions).toEqual([
      {
        command: "vspec pull",
        reason: "Refresh local files after successful push."
      }
    ]);
    expect(envelope.suggested_next_actions).toEqual(
      envelope.data.suggested_next_actions
    );
    expect(envelope.warnings).toEqual([
      { message: "Skipped unmanaged markdown file specs/SEED_NOTES.md." }
    ]);
    await expect(readSpec(root)).resolves.toContain("revision: rev-2");
  });

  test("agent push applies revisions before output", async () => {
    const root = tempRoot();
    writeSpec(root, "rev-1", "# Pays an invoice");
    stubFetch(pushResponse());
    const observedAtOutput: string[] = [];

    await runPush(syncFlags(root, { format: "agent" }), (line) => {
      observedAtOutput.push(readFileSync(specPath(root), "utf8"));
      observedAtOutput.push(line);
    });

    expect(observedAtOutput.at(0)).toContain("revision: rev-2");
    const envelope = expectAgentEnvelope<PushData>(observedAtOutput.at(1) ?? "");
    expect(envelope.data.results.at(0)?.current_revision).toBe("rev-2");
  });

  test("agent dry-run leaves files unchanged", async () => {
    const root = tempRoot();
    writeSpec(root, "rev-1", "# Pays an invoice");
    stubFetch(pushResponse({ dryRun: true, revision: "rev-dry" }));
    const lines: string[] = [];

    await runPush(syncFlags(root, { "dry-run": "true", format: "agent" }), (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<PushData>(stdout);
    expect(envelope.data.results.at(0)?.dry_run).toBe(true);
    await expect(readSpec(root)).resolves.toContain("revision: rev-1");
  });

  test("human push output", async () => {
    const root = tempRoot();
    writeSpec(root, "rev-1", "# Pays an invoice");
    writeUnmanagedNote(root);
    stubFetch(pushResponse());
    const lines: string[] = [];

    await runPush(syncFlags(root), (line) => lines.push(line));

    expect(lines).toContain("Results 1");
    expect(lines).toContain("Result specs/PAY-1.md OK");
    expect(lines).toContain("Revision rev-2");
    expect(lines).toContain("Cache specs/PAY-1.md SYNCED");
    expect(lines).toContain("Cache revision rev-2");
    expect(lines).toContain(
      "Warning Skipped unmanaged markdown file specs/SEED_NOTES.md."
    );
    expect(lines).toContain("vspec pull");
  });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-push-agent-"));
  tempRoots.push(root);
  return root;
}

function syncFlags(
  root: string,
  overrides: Record<string, string> = {}
): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "project-id": "project-1",
    root,
    "session-cookie": "session-token",
    ...overrides
  };
}

function writeSpec(root: string, revision: string, title: string): void {
  mkdirSync(join(root, "specs"), { recursive: true });
  writeFileSync(specPath(root), `---\nrevision: ${revision}\n---\n${title}\n`);
}

function writeUnmanagedNote(root: string): void {
  mkdirSync(join(root, "specs"), { recursive: true });
  writeFileSync(join(root, "specs", "SEED_NOTES.md"), "# Seed notes\n");
}

function specPath(root: string): string {
  return join(root, "specs", "PAY-1.md");
}

function readSpec(root: string): Promise<string> {
  return readFile(specPath(root), "utf8");
}

function stubFetch(body: PushData): void {
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

function pushResponse(
  overrides: { dryRun?: boolean; revision?: string } = {}
): PushData {
  const revision = overrides.revision ?? "rev-2";
  return {
    cache: {
      entries: [
        {
          path: "specs/PAY-1.md",
          revision,
          status: "SYNCED"
        }
      ]
    },
    results: [
      {
        current_revision: revision,
        dry_run: overrides.dryRun,
        path: "specs/PAY-1.md",
        status: "OK"
      }
    ],
    suggested_next_actions: [
      {
        command: "vspec pull",
        reason: "Refresh local files after successful push."
      }
    ]
  };
}

function expectAgentEnvelope<TData>(stdout: string): AgentEnvelope<TData> {
  const envelope = JSON.parse(stdout) as unknown as AgentEnvelope<TData>;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function defaultContext(): AgentEnvelope<unknown>["context"] {
  return {
    branch: null,
    project_key: null,
    revision: null,
    session_id: null
  };
}
