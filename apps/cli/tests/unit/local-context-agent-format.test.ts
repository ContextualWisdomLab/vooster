import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { readConfig, writeConfig } from "../../src/config-store.js";
import { runProject } from "../../src/commands/project.js";
import { runStatus } from "../../src/commands/status.js";
import { runWorkspace } from "../../src/commands/workspace.js";

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

type StatusData = {
  config: {
    api_url?: string;
    current_project_key?: string;
    current_workspace_id?: string;
    current_workspace_slug?: string;
    profile?: string;
  };
};

type WorkspaceSwitchData = {
  config: {
    current_workspace_id: string;
    current_workspace_slug: string;
  };
  workspace: {
    id: string;
    slug: string;
  };
};

type ProjectSwitchData = {
  config: {
    current_project_key: string;
  };
  project: {
    key: string;
  };
};

const previousConfigPath = process.env.VSPEC_CONFIG_PATH;

afterEach(() => {
  if (previousConfigPath === undefined) {
    delete process.env.VSPEC_CONFIG_PATH;
    return;
  }
  process.env.VSPEC_CONFIG_PATH = previousConfigPath;
});

describe("local context --format=agent", () => {
  test("agent status", () => {
    useIsolatedConfig();
    writeConfig({
      api_url: "https://api.example.test",
      current_project_key: "PAY",
      current_workspace_id: "workspace-1",
      current_workspace_slug: "payments",
      profile: "default"
    });
    const lines: string[] = [];

    runStatus({ format: "agent" }, (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<StatusData>(stdout);
    expect(envelope.data.config.current_project_key).toBe("PAY");
    expect(envelope.data.config.current_workspace_id).toBe("workspace-1");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
  });

  test("agent workspace switch", () => {
    useIsolatedConfig();
    const lines: string[] = [];

    runWorkspace({ format: "agent" }, "switch", "workspace-two", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<WorkspaceSwitchData>(stdout);
    expect(envelope.data.workspace.slug).toBe("workspace-two");
    expect(envelope.data.config.current_workspace_id).toBe("workspace-two");
    expect(envelope.data.config.current_workspace_slug).toBe("workspace-two");
    expect(readConfig().current_workspace_slug).toBe("workspace-two");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
  });

  test("agent project switch", async () => {
    useIsolatedConfig();
    const lines: string[] = [];

    await runProject({ format: "agent" }, "switch", (line) => lines.push(line), "PAY");

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<ProjectSwitchData>(stdout);
    expect(envelope.data.project.key).toBe("PAY");
    expect(envelope.data.config.current_project_key).toBe("PAY");
    expect(readConfig().current_project_key).toBe("PAY");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
  });

  test("human local context output", async () => {
    useIsolatedConfig();
    writeConfig({
      api_url: "https://api.example.test",
      current_project_key: "PAY",
      current_workspace_id: "workspace-1",
      profile: "default"
    });
    const statusLines: string[] = [];
    runStatus({}, (line) => statusLines.push(line));
    expect(statusLines).toContain("api_url https://api.example.test");
    expect(statusLines).toContain("current_project_key PAY");

    const workspaceLines: string[] = [];
    runWorkspace({}, "switch", "workspace-two", (line) => workspaceLines.push(line));
    expect(workspaceLines).toEqual(["Workspace workspace-two"]);

    const projectLines: string[] = [];
    await runProject({}, "switch", (line) => projectLines.push(line), "OPS");
    expect(projectLines).toEqual(["Project OPS"]);
  });
});

function useIsolatedConfig(): string {
  const configPath = join(mkdtempSync(join(tmpdir(), "vspec-local-context-")), "config.json");
  process.env.VSPEC_CONFIG_PATH = configPath;
  return configPath;
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
