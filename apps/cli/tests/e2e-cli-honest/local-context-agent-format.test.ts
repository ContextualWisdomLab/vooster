import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

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
    current_project_key?: string;
    current_workspace_id?: string;
    current_workspace_slug?: string;
  };
};

type WorkspaceSwitchData = {
  config: {
    current_workspace_id: string;
    current_workspace_slug: string;
  };
  workspace: {
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

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI local context --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-local-context-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "LOC",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent local context lifecycle", async () => {
    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");

    const initialStatus = await expectOk(
      runCli(["status", "--format=agent"], seed.env)
    );
    const initialStatusEnvelope = expectAgentEnvelope<StatusData>(initialStatus.stdout);
    expect(initialStatusEnvelope.context).toEqual(defaultContext());
    expect(initialStatusEnvelope.data.config.current_project_key).toBe(seed.projectKey);

    const project = await expectOk(
      runCli(["project", "switch", "ALT", "--format=agent"], seed.env)
    );
    const projectEnvelope = expectAgentEnvelope<ProjectSwitchData>(project.stdout);
    expect(projectEnvelope.context).toEqual(defaultContext());
    expect(projectEnvelope.data.project.key).toBe("ALT");
    expect(projectEnvelope.data.config.current_project_key).toBe("ALT");

    const statusAfterProject = await expectOk(
      runCli(["status", "--format=agent"], seed.env)
    );
    const statusAfterProjectEnvelope = expectAgentEnvelope<StatusData>(
      statusAfterProject.stdout
    );
    expect(statusAfterProjectEnvelope.data.config.current_project_key).toBe("ALT");

    const workspace = await expectOk(
      runCli(["workspace", "switch", "workspace-two", "--format=agent"], seed.env)
    );
    const workspaceEnvelope = expectAgentEnvelope<WorkspaceSwitchData>(
      workspace.stdout
    );
    expect(workspaceEnvelope.context).toEqual(defaultContext());
    expect(workspaceEnvelope.data.workspace.slug).toBe("workspace-two");
    expect(workspaceEnvelope.data.config.current_workspace_id).toBe("workspace-two");
    expect(workspaceEnvelope.data.config.current_workspace_slug).toBe("workspace-two");

    const statusAfterWorkspace = await expectOk(
      runCli(["status", "--format=agent"], seed.env)
    );
    const statusAfterWorkspaceEnvelope = expectAgentEnvelope<StatusData>(
      statusAfterWorkspace.stdout
    );
    expect(statusAfterWorkspaceEnvelope.data.config.current_workspace_id).toBe(
      "workspace-two"
    );
    expect(statusAfterWorkspaceEnvelope.data.config.current_workspace_slug).toBe(
      "workspace-two"
    );
  });
});

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
