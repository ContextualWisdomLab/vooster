import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import {
  addMainStepViaCli,
  expectOk,
  seedViaCli,
  type CliSeed
} from "./cli-setup.js";

type AgentEnvelope<TData> = {
  context: {
    revision: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type HistoryData = {
  revisions: Array<{
    revision: string;
  }>;
};

type RevertData = {
  revision: {
    id: string;
  };
  usecase: {
    current_revision_id: string;
  };
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI revert --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-revert-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "RAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent revert", async () => {
    const initialRevision = await currentRevision();
    await addMainStepViaCli(seed, runCli);

    const result = await expectOk(runCli([
      "revert",
      seed.usecaseKey,
      "--to",
      initialRevision,
      "--summary",
      "Restore initial checkout wording",
      "--format=agent"
    ], seed.env));

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope<RevertData>(result.stdout);
    expect(envelope.data.revision.id).toBeTypeOf("string");
    expect(envelope.data.revision.id).not.toBe(initialRevision);
    expect(envelope.data.usecase.current_revision_id).toBe(envelope.data.revision.id);
    expect(envelope.context.revision).toBe(envelope.data.revision.id);
    expect(envelope.suggested_next_actions.at(0)?.command).toContain("vspec history");
  });
});

async function currentRevision(): Promise<string> {
  const history = await expectOk(runCli([
    "history",
    seed.usecaseKey,
    "--limit",
    "1",
    "--format=agent"
  ], seed.env));
  const envelope = expectAgentEnvelope<HistoryData>(history.stdout);
  const firstRevision = envelope.data.revisions[0];
  expect(firstRevision).toBeDefined();
  return (firstRevision as { revision: string }).revision;
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
