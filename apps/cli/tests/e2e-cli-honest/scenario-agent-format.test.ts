import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import {
  addStakeholderViaCli,
  expectOk,
  seedViaCli,
  type CliSeed
} from "./cli-setup.js";

type ScenarioAgentEnvelope = {
  affected_files?: unknown[];
  context: {
    revision: null | string;
  };
  data: {
    revision: {
      id: string;
      severity: string;
      version_number: number;
    };
    scenario: {
      id: string;
      outcome: string;
      type: string;
    };
    steps: unknown[];
  };
  dry_run?: boolean;
  format_version: 1;
  status?: "ok" | "error";
  suggested_next_actions: unknown[];
  warnings: unknown[];
};
type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI scenario add --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-scenario-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "SCA",
      runCli
    });
    await addStakeholderViaCli(seed, runCli);
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent scenario add", async () => {
    const result = await expectOk(
      runCli(
        [
          "scenario",
          "add",
          seed.usecaseKey,
          "--type",
          "main-success",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.scenario.id).toBeTypeOf("string");
    expect(envelope.data.scenario.type).toBe("MAIN_SUCCESS");
    expect(envelope.data.revision.id).toBeTypeOf("string");
    expect(envelope.context.revision).toBe(envelope.data.revision.id);
  });
});

function expectAgentEnvelope(stdout: string): ScenarioAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as ScenarioAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
