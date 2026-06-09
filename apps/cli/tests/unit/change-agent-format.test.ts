import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runChange } from "../../src/commands/change.js";

type ChangeAgentEnvelope = {
  context: {
    revision: null | string;
  };
  data: {
    preview_id?: string;
    revisions?: Array<{
      entity_id: string;
      revision_id: string;
    }>;
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: Array<{ message: string; type?: string }>;
};

const tempRoots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("change --format=agent", () => {
  test("agent change propose", async () => {
    stubFetch(previewBody());
    const lines: string[] = [];

    await runChange(proposeFlags({ format: "agent" }), "propose", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("Preview ");
    expect(stdout).not.toContain("Severity ");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.preview_id).toBe("preview-1");
    expect(envelope.context.revision).toBeNull();
    expect(envelope.suggested_next_actions.at(0)?.command).toBe(
      "vspec change commit --preview-id preview-1"
    );
    expect(envelope.warnings.at(0)?.message).toBe("Review impacted sessions.");
  });

  test("agent change commit", async () => {
    stubFetch(commitBody());
    const lines: string[] = [];

    await runChange(commitFlags({ format: "agent" }), "commit", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("Entity ");
    expect(stdout).not.toContain("Revision ");
    const envelope = expectAgentEnvelope(stdout);
    const firstRevision = firstCommittedRevision(envelope);
    expect(firstRevision.entity_id).toBe("usecase-1");
    expect(firstRevision.revision_id).toBe("revision-1");
    expect(envelope.context.revision).toBe("revision-1");
    expect(envelope.suggested_next_actions.at(0)?.command).toBe(
      "vspec history CHG-001"
    );
  });

  test("agent change commit without revisions", async () => {
    stubFetch({ revisions: [], suggested_next_actions: [] });
    const lines: string[] = [];

    await runChange(commitFlags({ format: "agent" }), "commit", (line) =>
      lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines.join("\n"));
    expect(envelope.context.revision).toBeNull();
  });

  test("agent change propose rejects an incomplete patch with an error envelope", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const lines: string[] = [];

    await runChange(
      proposeFlags({ format: "agent", patch: patchFile({ entity_type: "USECASE" }) }),
      "propose",
      (line) => lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = JSON.parse(stdout) as AgentErrorEnvelope;
    expect(stdout).not.toContain("ZodError");
    expect(envelope.status).toBe("error");
    expect(envelope.error).toEqual({
      code: "SCHEMA_INVALID",
      message: "Invalid change patch."
    });
    expect(envelope.suggested_next_actions).toContainEqual({
      command: "vspec change propose --patch <valid-patch.json>",
      reason: "Provide entity_id, entity_type USECASE, and supported fields."
    });
    expect(process.exitCode).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("human change propose", async () => {
    stubFetch(previewBody());
    const lines: string[] = [];

    await runChange(proposeFlags(), "propose", (line) => lines.push(line));

    expect(lines).toContain("Preview preview-1");
    expect(lines).toContain("Severity NON_BREAKING");
    expect(lines).toContain("Warning IMPACT Review impacted sessions.");
  });

  test("human change commit", async () => {
    stubFetch(commitBody());
    const lines: string[] = [];

    await runChange(commitFlags(), "commit", (line) => lines.push(line));

    expect(lines).toContain("Entity usecase-1");
    expect(lines).toContain("Revision revision-1");
    expect(lines).toContain("vspec history CHG-001");
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

function proposeFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "base-revision": "revision-base",
    patch: patchFile(),
    "session-cookie": "session-token",
    usecase: "CHG-001",
    ...overrides
  };
}

function commitFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "preview-id": "preview-1",
    "session-cookie": "session-token",
    ...overrides
  };
}

type AgentErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
  status: "error";
  suggested_next_actions: Array<{
    command: string;
    reason?: string;
  }>;
};

function patchFile(
  patch: unknown = {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    fields: { title: "Reviews a refund" }
  }
): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-change-agent-"));
  tempRoots.push(root);
  const path = join(root, "patch.json");
  writeFileSync(path, JSON.stringify(patch), "utf8");
  return path;
}

function previewBody() {
  return {
    diff: [
      {
        after: "Reviews a refund",
        before: "Reviews an order",
        entity_id: "usecase-1",
        entity_type: "USECASE",
        path: "title",
        severity: "NON_BREAKING"
      }
    ],
    expires_at: "2026-05-22T00:15:00.000Z",
    impact: {
      affected_sessions: [],
      severity: "NON_BREAKING"
    },
    preview_id: "preview-1",
    severity: "NON_BREAKING",
    suggested_next_actions: [
      {
        command: "vspec change commit --preview-id preview-1",
        reason: "Commit the preview after human review."
      }
    ],
    warnings: [{ message: "Review impacted sessions.", type: "IMPACT" }]
  };
}

function commitBody() {
  return {
    revisions: [
      {
        entity_id: "usecase-1",
        revision_id: "revision-1"
      }
    ],
    suggested_next_actions: [
      { command: "vspec history CHG-001", reason: "Review the committed revision." }
    ]
  };
}

function expectAgentEnvelope(stdout: string): ChangeAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as ChangeAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function firstCommittedRevision(envelope: ChangeAgentEnvelope): {
  entity_id: string;
  revision_id: string;
} {
  const firstRevision = envelope.data.revisions?.[0];
  expect(firstRevision).toBeDefined();
  return firstRevision as { entity_id: string; revision_id: string };
}
