import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { readConfig } from "../../src/config-store.js";
import { runProject } from "../../src/commands/project.js";

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

type ProjectCreateData = {
  default_branch: {
    base_branch_id: null | string;
    id: string;
    name: string;
    owner_id: string;
    owner_type: string;
    project_id: string;
  };
  project: {
    default_branch_id: string;
    id: string;
    key: string;
    name: string;
    visibility: string;
    workspace_id: string;
  };
  recommended_next_command: string;
};

const previousConfigPath = process.env.VSPEC_CONFIG_PATH;

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousConfigPath === undefined) {
    delete process.env.VSPEC_CONFIG_PATH;
    return;
  }
  process.env.VSPEC_CONFIG_PATH = previousConfigPath;
});

describe("project create --format=agent", () => {
  test("agent project create", async () => {
    useIsolatedConfig();
    stubFetch(projectCreateResponse());
    const lines: string[] = [];

    await runProject(projectCreateFlags({ format: "agent" }), "create", (line) =>
      lines.push(line)
    );

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<ProjectCreateData>(stdout);
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.data.project.id).toBe("project-1");
    expect(envelope.data.project.key).toBe("PAY");
    expect(envelope.data.default_branch.name).toBe("main");
    expect(envelope.data.recommended_next_command).toBe("vspec actor create");
    expect(envelope.suggested_next_actions.at(0)?.command).toBe("vspec actor create");
    expect(envelope.warnings).toEqual([]);
    expect(readConfig().current_project_id).toBe("project-1");
    expect(readConfig().current_project_key).toBe("PAY");
  });

  test("human project create output", async () => {
    useIsolatedConfig();
    stubFetch(projectCreateResponse());
    const lines: string[] = [];

    await runProject(projectCreateFlags(), "create", (line) => lines.push(line));

    expect(lines).toEqual([
      "Project Payments PAY project-1",
      "Branch main",
      "vspec actor create"
    ]);
    expect(readConfig().current_project_id).toBe("project-1");
    expect(readConfig().current_project_key).toBe("PAY");
  });
});

function useIsolatedConfig(): string {
  const configPath = join(
    mkdtempSync(join(tmpdir(), "vspec-project-create-")),
    "config.json"
  );
  process.env.VSPEC_CONFIG_PATH = configPath;
  return configPath;
}

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

function projectCreateFlags(
  overrides: Record<string, string> = {}
): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    key: "PAY",
    name: "Payments",
    "session-cookie": "session-token",
    "workspace-id": "workspace-1",
    ...overrides
  };
}

function projectCreateResponse(): ProjectCreateData {
  return {
    default_branch: {
      base_branch_id: null,
      id: "branch-1",
      name: "main",
      owner_id: "user-1",
      owner_type: "HUMAN",
      project_id: "project-1"
    },
    project: {
      default_branch_id: "branch-1",
      id: "project-1",
      key: "PAY",
      name: "Payments",
      visibility: "PRIVATE",
      workspace_id: "workspace-1"
    },
    recommended_next_command: "vspec actor create"
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
