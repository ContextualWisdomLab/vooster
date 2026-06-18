import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type ImpactAgentEnvelope = {
  context: {
    revision: null | string;
  };
  data: {
    impact: {
      input_hash: string;
      severity: string;
    };
    preview_id: string;
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI impact --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-impact-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "IAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("agent impact", async () => {
    const result = await expectOk(
      runCli(["impact", seed.usecaseKey, "--format=agent"], seed.env)
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.preview_id).toBeTypeOf("string");
    expect(envelope.data.impact.input_hash).toBeTypeOf("string");
    expect(envelope.data.impact.severity).toBeTypeOf("string");
    expect(envelope.context.revision).toBeTypeOf("string");
    expect(envelope.suggested_next_actions.at(0)?.command).toContain("vspec lock");
  });
});

function expectAgentEnvelope(stdout: string): ImpactAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as ImpactAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
