import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type WhoAgentEnvelope = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: {
    locks: unknown[];
    merge_requests: unknown[];
    sessions: unknown[];
    usecase: {
      key: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI who --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-who-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "WAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("agent who", async () => {
    const result = await expectOk(
      runCli(["who", seed.usecaseKey, "--format=agent"], seed.env)
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.usecase.key).toBe(seed.usecaseKey);
    expect(envelope.data.sessions).toEqual([]);
    expect(envelope.data.locks).toEqual([]);
    expect(envelope.data.merge_requests).toEqual([]);
    expect(envelope.context).toEqual({
      branch: null,
      project_key: null,
      revision: null,
      session_id: null
    });
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec session start"
    );
  });
});

function expectAgentEnvelope(stdout: string): WhoAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as WhoAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
