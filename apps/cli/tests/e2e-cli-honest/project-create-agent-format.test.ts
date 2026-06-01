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

type ProjectCreateData = {
  default_branch: {
    name: string;
  };
  project: {
    id: string;
    key: string;
  };
  recommended_next_command: string;
};

type StatusData = {
  config: {
    current_project_key?: string;
  };
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI project create --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-project-create-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "PCA",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent project create updates active project", async () => {
    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const createdKey = "PCZ";

    const created = await expectOk(
      runCli(
        [
          "project",
          "create",
          "--name",
          "Created Project",
          "--key",
          createdKey,
          "--format=agent"
        ],
        seed.env
      )
    );
    const createEnvelope = expectAgentEnvelope<ProjectCreateData>(created.stdout);
    expect(createEnvelope.context).toEqual(defaultContext());
    expect(createEnvelope.data.project.id.length).toBeGreaterThan(0);
    expect(createEnvelope.data.project.key).toBe(createdKey);
    expect(createEnvelope.data.default_branch.name).toBe("main");
    expect(createEnvelope.data.recommended_next_command).toBe("vspec actor create");

    const status = await expectOk(runCli(["status", "--format=agent"], seed.env));
    const statusEnvelope = expectAgentEnvelope<StatusData>(status.stdout);
    expect(statusEnvelope.data.config.current_project_key).toBe(createdKey);
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
