import { afterEach, describe, expect, test, vi } from "vitest";

import { runMerge } from "../../src/commands/merge.js";

type MergeResolveAgentEnvelope = {
  context: {
    branch: null | string;
    revision: null | string;
  };
  data: {
    merge_request: {
      id: string;
      status: string;
    };
    new_revisions: Array<{
      id: string;
    }>;
    source_branch: {
      id: string;
      name: string;
      status: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("merge resolve --format=agent", () => {
  test("agent merge resolve", async () => {
    stubFetch(mergeResolveBody());
    const lines: string[] = [];

    await runMerge(mergeFlags({ format: "agent" }), "resolve", "merge-1", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("Merge request ");
    expect(stdout).not.toContain("Status ");
    expect(stdout).not.toContain("New revisions ");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.merge_request.id).toBe("merge-1");
    expect(envelope.data.new_revisions.at(0)?.id).toBe("revision-2");
    expect(envelope.data.source_branch.id).toBe("branch-1");
    expect(envelope.context.branch).toBe("feature/resolve-refund");
    expect(envelope.context.revision).toBe("revision-2");
    expect(envelope.suggested_next_actions.at(0)?.command).toBe(
      "vspec usecase show RSV-001"
    );
    expect(envelope.warnings).toEqual([]);
  });

  test("agent merge resolve without new revision", async () => {
    stubFetch(mergeResolveBody({ newRevisions: [] }));
    const lines: string[] = [];

    await runMerge(mergeFlags({ format: "agent" }), "resolve", "merge-1", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.new_revisions).toEqual([]);
    expect(envelope.context.branch).toBe("feature/resolve-refund");
    expect(envelope.context.revision).toBeNull();
  });

  test("human merge resolve output", async () => {
    stubFetch(mergeResolveBody());
    const lines: string[] = [];

    await runMerge(mergeFlags(), "resolve", "merge-1", (line) => lines.push(line));

    expect(lines).toContain("Merge request merge-1");
    expect(lines).toContain("Status MERGED");
    expect(lines).toContain("Conflicts 0");
    expect(lines).toContain("New revisions 1");
    expect(lines).toContain("Source branch branch-1 MERGED");
    expect(lines).toContain("Main heads 1");
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

function mergeFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    "base-revision": "revision-1",
    "entity-id": "usecase-1",
    field: "title",
    "session-cookie": "session-token",
    strategy: "theirs",
    ...overrides
  };
}

function mergeResolveBody(overrides: { newRevisions?: Array<{ id: string }> } = {}) {
  return {
    main_head_revision_ids: {
      "usecase-1": "revision-2"
    },
    merge_request: {
      conflicts: [],
      id: "merge-1",
      status: "MERGED"
    },
    new_revisions: overrides.newRevisions ?? [
      {
        entity_id: "usecase-1",
        id: "revision-2"
      }
    ],
    source_branch: {
      id: "branch-1",
      name: "feature/resolve-refund",
      status: "MERGED"
    },
    suggested_next_actions: [{ command: "vspec usecase show RSV-001" }]
  };
}

function expectAgentEnvelope(stdout: string): MergeResolveAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as MergeResolveAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
