import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runPull } from "../../src/commands/pull.js";
import { runSync } from "../../src/commands/sync.js";

type AgentEnvelope<TData> = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type PullData = {
  cursor: string;
  files: Array<{
    content: string;
    path: string;
    revision: string;
  }>;
};

const tempRoots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("pull/sync --format=agent", () => {
  test("agent pull", async () => {
    const root = tempRoot();
    stubFetch(pullResponse());
    const lines: string[] = [];

    await runPull(syncFlags(root, { format: "agent" }), (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<PullData>(stdout);
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.data.cursor).toBe("rev-2");
    expect(envelope.data.files.at(0)?.path).toBe("specs/PAY-1.md");
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
    await expect(readFile(join(root, "specs", "PAY-1.md"), "utf8")).resolves.toContain(
      "# Pays an invoice"
    );
  });

  test("agent sync uses pull behavior", async () => {
    const root = tempRoot();
    stubFetch(pullResponse());
    const lines: string[] = [];

    await runSync(syncFlags(root, { format: "agent" }), "sync", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<PullData>(stdout);
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.data.cursor).toBe("rev-2");
    expect(envelope.data.files).toHaveLength(1);
    await expect(readFile(join(root, "specs", "PAY-1.md"), "utf8")).resolves.toContain(
      "revision: rev-2"
    );
  });

  test("human pull output", async () => {
    const root = tempRoot();
    stubFetch(pullResponse());
    const lines: string[] = [];

    await runPull(syncFlags(root), (line) => lines.push(line));

    expect(lines).toContain("Cursor rev-2");
    expect(lines).toContain("File specs/PAY-1.md");
    expect(lines).toContain("Revision rev-2");
  });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-pull-sync-agent-"));
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

function stubFetch(body: PullData): void {
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

function pullResponse(): PullData {
  return {
    cursor: "rev-2",
    files: [
      {
        content: "---\nrevision: rev-2\n---\n# Pays an invoice\n",
        path: "specs/PAY-1.md",
        revision: "rev-2"
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
