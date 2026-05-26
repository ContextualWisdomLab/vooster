import { afterEach, describe, expect, test, vi } from "vitest";

import { runBranch } from "../../src/commands/branch.js";

type BranchAgentEnvelope = {
  context: {
    branch: null | string;
  };
  data: {
    branch: {
      id: string;
      name: string;
      status: string;
    };
  };
  format_version: 1;
  suggested_next_actions: unknown[];
  warnings: unknown[];
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("branch create --format=agent", () => {
  test("agent branch create", async () => {
    stubFetch(branchBody());
    const lines: string[] = [];

    await runBranch(
      branchFlags({ format: "agent" }),
      "create",
      "feature/agent-branch",
      (line) => lines.push(line)
    );

    const envelope = expectAgentEnvelope(lines);
    expect(envelope.data.branch.id).toBe("branch-1");
    expect(envelope.data.branch.name).toBe("feature/agent-branch");
    expect(envelope.data.branch.status).toBe("ACTIVE");
    expect(envelope.context.branch).toBe("feature/agent-branch");
  });

  test("human branch create", async () => {
    stubFetch(branchBody());
    const lines: string[] = [];

    await runBranch(branchFlags(), "create", "feature/agent-branch", (line) =>
      lines.push(line)
    );

    expect(lines).toContain("Branch branch-1");
    expect(lines).toContain("Name feature/agent-branch");
    expect(lines).toContain("Status ACTIVE");
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

function branchFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    from: "main",
    "project-id": "project-1",
    "session-cookie": "session-token",
    ...overrides
  };
}

function branchBody() {
  return {
    branch: {
      base_branch_id: "branch-main",
      base_revision_ids: {},
      head_revision_ids: {},
      id: "branch-1",
      name: "feature/agent-branch",
      owner_id: "user-1",
      owner_type: "HUMAN",
      project_id: "project-1",
      status: "ACTIVE"
    },
    suggested_next_actions: [
      {
        command: "vspec branch diff feature/agent-branch",
        reason: "Inspect branch changes."
      }
    ]
  };
}

function expectAgentEnvelope(lines: string[]): BranchAgentEnvelope {
  const envelope = JSON.parse(lines.join("\n")) as unknown as BranchAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
