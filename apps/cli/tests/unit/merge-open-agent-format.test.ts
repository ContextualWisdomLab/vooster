import { afterEach, describe, expect, test, vi } from "vitest";

import { runMerge } from "../../src/commands/merge.js";

type MergeOpenAgentEnvelope = {
  context: {
    branch: null | string;
  };
  data: {
    merge_request: {
      id: string;
      status: string;
    };
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

describe("merge open --format=agent", () => {
  test("agent merge open", async () => {
    stubFetch(mergeOpenBody());
    const lines: string[] = [];

    await runMerge(mergeFlags({ format: "agent" }), "open", "branch-1", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    expect(stdout).not.toContain("Merge request ");
    expect(stdout).not.toContain("Status ");
    expect(stdout).not.toContain("Strategy ");
    expect(stdout).not.toContain("Conflicts ");
    expect(stdout).not.toContain("Impacted entities ");
    expect(stdout).not.toContain("Source branch ");
    expect(stdout).not.toContain("Main heads ");
    const envelope = expectAgentEnvelope(stdout);
    expect(envelope.data.merge_request.id).toBe("merge-1");
    expect(envelope.data.source_branch.id).toBe("branch-1");
    expect(envelope.data.source_branch.name).toBe("agent/merge-open");
    expect(envelope.context.branch).toBe("agent/merge-open");
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec merge resolve merge-1"
    );
    expect(envelope.warnings).toEqual([]);
  });

  test("human merge open", async () => {
    stubFetch(mergeOpenBody());
    const lines: string[] = [];

    await runMerge(mergeFlags(), "open", "branch-1", (line) => lines.push(line));

    expect(lines).toContain("Merge request merge-1");
    expect(lines).toContain("Status OPEN");
    expect(lines).toContain("Strategy SQUASH");
    expect(lines).toContain("Conflicts 1");
    expect(lines).toContain("Source branch branch-1 ACTIVE");
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
    "session-cookie": "session-token",
    ...overrides
  };
}

function mergeOpenBody() {
  return {
    main_head_revision_ids: {
      "usecase-1": "revision-main"
    },
    merge_request: {
      conflicts: [
        {
          entity_id: "usecase-1",
          field: "title"
        }
      ],
      id: "merge-1",
      impact: {
        severity_by_entity: {
          "usecase-1": "BREAKING"
        }
      },
      status: "OPEN",
      strategy: "SQUASH"
    },
    source_branch: {
      id: "branch-1",
      name: "agent/merge-open",
      status: "ACTIVE"
    },
    suggested_next_actions: [
      {
        command: "vspec merge resolve merge-1",
        reason: "Resolve conflicts before this branch can merge."
      }
    ]
  };
}

function expectAgentEnvelope(stdout: string): MergeOpenAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as MergeOpenAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
