import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type HistoryAgentEnvelope = {
  context: {
    revision: null | string;
  };
  data: {
    revisions: Array<{
      revision: string;
    }>;
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

describe("honest CLI history --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-history-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "HAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent history", async () => {
    const result = await expectOk(runCli([
      "history",
      seed.usecaseKey,
      "--format=agent"
    ], seed.env));

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    const firstRevision = firstHistoryRevision(envelope);
    expect(envelope.data.usecase.key).toBe(seed.usecaseKey);
    expect(envelope.context.revision).toBeTypeOf("string");
    expect(firstRevision.revision).toBe(envelope.context.revision);
    expect(envelope.suggested_next_actions.at(0)?.command).toContain("vspec usecase show");
  });
});

function expectAgentEnvelope(stdout: string): HistoryAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as HistoryAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function firstHistoryRevision(envelope: HistoryAgentEnvelope): { revision: string } {
  const firstRevision = envelope.data.revisions[0];
  expect(firstRevision).toBeDefined();
  return firstRevision as { revision: string };
}
